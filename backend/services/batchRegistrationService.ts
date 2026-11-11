import { Prisma } from "@prisma/client";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import {
  countBatchOccupied,
  countOccupiedSlots,
  getEventBatchState,
} from "@/backend/services/eventBatchService";
import {
  findDuplicatedCpfs,
  validateEventForBatch,
  validateParticipantFields,
  type EventForValidation,
  type NormalizedParticipant,
  type ParticipantIssue,
  type RegistrationMode,
} from "@/backend/services/registrationValidation";
import {
  parseOrderNsu,
  type ParsedInfinitePayWebhook,
} from "@/backend/services/payment/infinitePayService";
import {
  resolveBaseValue,
  resolveShirtOnlyValue,
} from "@/backend/utils/shirtPricing";
import type {
  FreeBatchParticipantInput,
  PaidBatchParticipantInput,
} from "@/backend/schemas/batchRegistrationSchemas";

type Tx = Prisma.TransactionClient;

/** Opções das transações de lote: até 10 inserções + lock, com folga para o pooler. */
const TX_OPTIONS = { maxWait: 5000, timeout: 15000 } as const;

export type ServiceFailure = {
  ok: false;
  status: number;
  error: string;
  errors?: ParticipantIssue[];
};

/**
 * Padrão de lock do projeto: dentro de `$transaction`, trava a linha com
 * `SELECT ... FOR UPDATE`. Transações concorrentes sobre a mesma linha
 * (evento ou pedido) esperam a primeira terminar — assim a checagem de vagas
 * e a leitura do pedido nunca enxergam um estado já superado.
 * `table` é sempre literal do código (nunca entrada do usuário).
 */
export async function lockRow(
  tx: Tx,
  table: "events" | "orders",
  id: string
): Promise<void> {
  if (table === "events") {
    await tx.$queryRaw`SELECT id FROM events WHERE id = ${id} FOR UPDATE`;
  } else {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id} FOR UPDATE`;
  }
}

/** Valor de uma inscrição do pedido em centavos (lote gravado na inscrição). */
export function registrationValueCents(
  event: { price: number; shirtConfig?: unknown },
  r: {
    wantsShirt: boolean | null;
    batch: { price: number; priceWithShirt: number | null } | null;
  }
): number {
  return Math.round(
    resolveBaseValue(event, r.wantsShirt ?? false, r.batch) * 100
  );
}

export function appendHistory(
  details: unknown,
  entry: Record<string, unknown>
): Prisma.InputJsonValue {
  const base =
    details && typeof details === "object" && !Array.isArray(details)
      ? (details as Record<string, unknown>)
      : {};
  const history = Array.isArray(base.history) ? base.history : [];
  return { ...base, history: [...history, entry] } as Prisma.InputJsonValue;
}

interface ExistingRow {
  id: string;
  status: string;
  orderId: string | null;
}

/**
 * Resolve conflitos de CPF com inscrições já existentes no evento.
 * Retorna o erro (se houver) ou a inscrição a reaproveitar (CANCELLED /
 * PAYMENT_FAILED, como no fluxo individual — nunca criar duplicata).
 */
function classifyExisting(
  rows: ExistingRow[],
  index: number
): { issue?: ParticipantIssue; reuseId?: string } {
  if (rows.length === 0) return {};
  const confirmed = rows.find((r) => r.status === "CONFIRMED");
  if (confirmed) {
    return {
      issue: {
        index,
        field: "cpf",
        message: "CPF já possui inscrição confirmada neste evento",
        code: "CPF_ALREADY_REGISTERED",
      },
    };
  }
  const pending = rows.find((r) => r.status === "PENDING");
  if (pending) {
    return {
      issue: pending.orderId
        ? {
            index,
            field: "cpf",
            message:
              "Esta pessoa já faz parte de uma compra em grupo com pagamento pendente. Peça para ela acessar a inscrição com o próprio CPF para resolver antes de entrar em um novo grupo.",
            code: "CPF_IN_OTHER_ORDER",
          }
        : {
            index,
            field: "cpf",
            message:
              "Esta pessoa já tem uma inscrição com pagamento pendente. Ela deve concluir o pagamento ou continuar a inscrição pelo CPF.",
            code: "CPF_PENDING_INDIVIDUAL",
          },
    };
  }
  return { reuseId: rows[0].id };
}

function failure(
  status: number,
  error: string,
  errors?: ParticipantIssue[]
): ServiceFailure {
  return { ok: false, status, error, errors };
}

/** 409 quando há conflito de CPF com outra inscrição; 422 nos demais erros. */
function issuesFailure(issues: ParticipantIssue[]): ServiceFailure {
  const conflict = issues.some((i) =>
    ["CPF_ALREADY_REGISTERED", "CPF_PENDING_INDIVIDUAL", "CPF_IN_OTHER_ORDER"].includes(
      i.code
    )
  );
  return failure(
    conflict ? 409 : 422,
    conflict
      ? "Há participantes que já possuem inscrição neste evento"
      : "Dados inválidos",
    issues.sort((a, b) => a.index - b.index)
  );
}

/** Validação sem banco de todos os participantes (campos + CPF repetido). */
function validateAll(
  event: EventForValidation,
  participants: (PaidBatchParticipantInput | FreeBatchParticipantInput)[],
  mode: RegistrationMode
): { issues: ParticipantIssue[]; normalized: NormalizedParticipant[] } {
  const issues: ParticipantIssue[] = [];
  const normalized: NormalizedParticipant[] = [];
  participants.forEach((p, i) => {
    const r = validateParticipantFields(event, p, i, mode);
    issues.push(...r.issues);
    if (r.normalized) normalized.push(r.normalized);
  });
  issues.push(
    ...findDuplicatedCpfs(
      participants.map((p) => p.cpf.replace(/\D/g, ""))
    )
  );
  return { issues, normalized };
}

type EventForPaidBatch = EventForValidation & {
  id: string;
  title: string;
  price: number;
  maxParticipants: number;
};

export interface CreatedPaidOrder {
  ok: true;
  order: { id: string; totalValue: number; totalCents: number };
  buyer: { name: string; email: string | null; phone: string | null };
  items: { registrationId: string; name: string; value: number }[];
  batchName: string | null;
}

/**
 * Cria Order + N inscrições PENDING de forma atômica. Dentro da transação,
 * com o evento travado (`FOR UPDATE`): conflitos de CPF, vagas globais e
 * quota do lote vigente (N vagas de uma vez); só então persiste.
 * Todos os participantes usam o mesmo lote, o vigente no momento da criação.
 */
export async function createPaidBatchOrder(
  event: EventForPaidBatch,
  participants: PaidBatchParticipantInput[],
  now: Date = new Date()
): Promise<CreatedPaidOrder | ServiceFailure> {
  const gate = validateEventForBatch(event, "PAID", now);
  if (gate) return failure(gate.status, gate.error);

  const { issues, normalized } = validateAll(event, participants, "PAID");
  if (issues.length > 0) return issuesFailure(issues);

  return withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockRow(tx, "events", event.id);

      const existing = await tx.registration.findMany({
        where: { eventId: event.id, cpf: { in: normalized.map((p) => p.cpf) } },
        select: { id: true, cpf: true, status: true, orderId: true },
      });
      const reuse: (string | undefined)[] = [];
      const conflicts: ParticipantIssue[] = [];
      normalized.forEach((p, i) => {
        const r = classifyExisting(
          existing.filter((e) => e.cpf === p.cpf),
          i
        );
        if (r.issue) conflicts.push(r.issue);
        reuse[i] = r.reuseId;
      });
      if (conflicts.length > 0) return issuesFailure(conflicts);

      const n = normalized.length;
      const occupied = await countOccupiedSlots(tx, event.id);
      const available = Math.max(event.maxParticipants - occupied, 0);
      if (n > available) {
        return failure(
          409,
          available === 0
            ? "Evento lotado"
            : `Vagas insuficientes: restam ${available} vaga(s) e a compra tem ${n} participante(s)`
        );
      }

      const batchState = await getEventBatchState(tx, event.id, { now });
      if (batchState.hasBatches && !batchState.activeBatch) {
        return failure(400, "Período de inscrições encerrado");
      }
      const batch = batchState.activeBatch;
      if (batch && batch.quota !== null) {
        const left = Math.max(
          batch.quota - (await countBatchOccupied(tx, batch.id)),
          0
        );
        if (n > left) {
          return failure(
            409,
            `Vagas insuficientes no lote atual: restam ${left} vaga(s) e a compra tem ${n} participante(s)`
          );
        }
      }

      const valuesCents = normalized.map((p) =>
        Math.round(resolveBaseValue(event, p.wantsShirt, batch) * 100)
      );
      const totalCents = valuesCents.reduce((a, b) => a + b, 0);

      const order = await tx.order.create({
        data: {
          eventId: event.id,
          type: "BATCH",
          status: "PENDING",
          paymentMethod: "INFINITE_PAY",
          totalValue: totalCents / 100,
          amountCents: totalCents,
        },
      });

      const items: CreatedPaidOrder["items"] = [];
      for (let i = 0; i < n; i++) {
        const p = normalized[i];
        const data = {
          name: p.name,
          email: p.email,
          phone: p.phone,
          status: "PENDING" as const,
          paymentMethod: "INFINITE_PAY" as const,
          paymentId: null,
          paymentError: null,
          paymentDetails: Prisma.JsonNull,
          wantsShirt: p.wantsShirt,
          shirtSize: p.shirtSize,
          batchId: batch?.id ?? null,
          orderId: order.id,
          dynamicFormData: p.dynamicFormData
            ? (p.dynamicFormData as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        };
        const reg = reuse[i]
          ? await tx.registration.update({ where: { id: reuse[i] }, data })
          : await tx.registration.create({
              data: {
                ...data,
                eventId: event.id,
                cpf: p.cpf,
                // Ordem estável: o 1º participante (responsável) é o mais antigo
                createdAt: new Date(now.getTime() + i),
              },
            });
        items.push({
          registrationId: reg.id,
          name: p.name,
          value: valuesCents[i] / 100,
        });
      }

      return {
        ok: true as const,
        order: { id: order.id, totalValue: totalCents / 100, totalCents },
        buyer: {
          name: normalized[0].name,
          email: normalized[0].email,
          phone: normalized[0].phone,
        },
        items,
        batchName: batch?.name ?? null,
      };
    }, TX_OPTIONS)
  );
}

export interface CreatedFreeBatch {
  ok: true;
  registrations: { id: string; name: string; status: string }[];
}

/** Lote gratuito: N inscrições CONFIRMED atômicas, sem Order (não há gateway). */
export async function createFreeBatch(
  event: EventForValidation & {
    id: string;
    maxParticipants: number;
  },
  participants: FreeBatchParticipantInput[],
  now: Date = new Date()
): Promise<CreatedFreeBatch | ServiceFailure> {
  const gate = validateEventForBatch(event, "FREE", now);
  if (gate) return failure(gate.status, gate.error);

  const { issues, normalized } = validateAll(event, participants, "FREE");
  if (issues.length > 0) return issuesFailure(issues);

  return withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockRow(tx, "events", event.id);

      const existing = await tx.registration.findMany({
        where: { eventId: event.id, cpf: { in: normalized.map((p) => p.cpf) } },
        select: { id: true, cpf: true, status: true, orderId: true },
      });
      const reuse: (string | undefined)[] = [];
      const conflicts: ParticipantIssue[] = [];
      normalized.forEach((p, i) => {
        const r = classifyExisting(
          existing.filter((e) => e.cpf === p.cpf),
          i
        );
        if (r.issue) conflicts.push(r.issue);
        reuse[i] = r.reuseId;
      });
      if (conflicts.length > 0) return issuesFailure(conflicts);

      const n = normalized.length;
      const occupied = await countOccupiedSlots(tx, event.id);
      const available = Math.max(event.maxParticipants - occupied, 0);
      if (n > available) {
        return failure(
          409,
          available === 0
            ? "Evento lotado"
            : `Vagas insuficientes: restam ${available} vaga(s) e a compra tem ${n} participante(s)`
        );
      }

      const stamp = Date.now();
      const registrations: CreatedFreeBatch["registrations"] = [];
      for (let i = 0; i < n; i++) {
        const p = normalized[i];
        const data = {
          name: p.name,
          email: p.email,
          phone: p.phone,
          status: "CONFIRMED" as const,
          paymentMethod: "FREE" as const,
          paymentId: `free_${stamp}_${Math.random().toString(36).slice(2, 11)}_${i}`,
          paymentError: null,
          orderId: null,
          dynamicFormData: p.dynamicFormData
            ? (p.dynamicFormData as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        };
        const reg = reuse[i]
          ? await tx.registration.update({ where: { id: reuse[i] }, data })
          : await tx.registration.create({
              data: { ...data, eventId: event.id, cpf: p.cpf },
            });
        registrations.push({ id: reg.id, name: reg.name, status: reg.status });
      }
      return { ok: true as const, registrations };
    }, TX_OPTIONS)
  );
}

/** Grava a referência do checkout vigente no pedido. */
export async function saveOrderCheckout(
  orderId: string,
  checkout: { providerRef: string; checkoutUrl: string },
  amountCents: number
): Promise<void> {
  await withPrismaRetry(() =>
    prisma.order.update({
      where: { id: orderId },
      data: {
        paymentId: checkout.providerRef,
        checkoutUrl: checkout.checkoutUrl,
        amountCents,
        paymentError: null,
      },
    })
  );
}

const orderWithRegistrations = {
  event: {
    select: { id: true, title: true, price: true, shirtConfig: true },
  },
  registrations: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    include: {
      batch: { select: { price: true, priceWithShirt: true } },
    },
  },
} satisfies Prisma.OrderInclude;

export type OrderWithRegistrations = Prisma.OrderGetPayload<{
  include: typeof orderWithRegistrations;
}>;

export interface OrderPaymentSnapshot {
  order: OrderWithRegistrations;
  /** Inscrições que ainda contam para o pedido (não canceladas). */
  active: OrderWithRegistrations["registrations"];
  items: { registrationId: string; name: string; valueCents: number }[];
  totalCents: number;
}

export function buildOrderSnapshot(
  order: OrderWithRegistrations
): OrderPaymentSnapshot {
  const active = order.registrations.filter((r) => r.status !== "CANCELLED");
  const items = active.map((r) => ({
    registrationId: r.id,
    name: r.name,
    valueCents: registrationValueCents(order.event, r),
  }));
  return {
    order,
    active,
    items,
    totalCents: items.reduce((a, b) => a + b.valueCents, 0),
  };
}

export type ContinueOrderResult =
  | { ok: true; snapshot: OrderPaymentSnapshot }
  | ServiceFailure;

/**
 * Prepara a retomada do pagamento: pedido PENDING com ao menos um participante.
 * Reconcilia o total com o recálculo atual (fonte de verdade do servidor).
 */
export async function prepareOrderForPayment(
  orderId: string
): Promise<ContinueOrderResult> {
  return withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockRow(tx, "orders", orderId);
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: orderWithRegistrations,
      });
      if (!order) return failure(404, "Pedido não encontrado");
      if (order.status === "CONFIRMED") {
        return failure(409, "Este pedido já foi pago");
      }
      if (order.status !== "PENDING") {
        return failure(409, "Este pedido não está mais disponível para pagamento");
      }
      const snapshot = buildOrderSnapshot(order);
      if (snapshot.active.length === 0 || snapshot.totalCents <= 0) {
        return failure(409, "Este pedido não possui participantes");
      }
      if (Math.round(order.totalValue * 100) !== snapshot.totalCents) {
        await tx.order.update({
          where: { id: orderId },
          data: {
            totalValue: snapshot.totalCents / 100,
            amountCents: snapshot.totalCents,
          },
        });
      }
      return { ok: true as const, snapshot };
    }, TX_OPTIONS)
  );
}

export type LeaveOrderResult =
  | {
      ok: true;
      registrationId: string;
      orderId: string;
      orderCancelled: boolean;
      newOrderTotal: number;
      remainingParticipants: number;
      individualAmount: number;
    }
  | ServiceFailure;

/**
 * Self-service: tira a inscrição do pedido PENDING (vira inscrição individual,
 * orderId = null) e recalcula o pedido com o lote das inscrições remanescentes.
 * O link de checkout vigente é invalidado (paymentId = null). Pedido esvaziado
 * vai para CANCELLED. Só o dono do CPF da inscrição pode sair.
 */
export async function leaveOrder(
  registrationId: string,
  cpf: string
): Promise<LeaveOrderResult> {
  const cpfDigits = cpf.replace(/\D/g, "");
  const registration = await withPrismaRetry(() =>
    prisma.registration.findUnique({
      where: { id: registrationId },
      select: { id: true, cpf: true, status: true, orderId: true },
    })
  );
  if (!registration) return failure(404, "Inscrição não encontrada");
  if (registration.cpf !== cpfDigits) {
    return failure(403, "CPF não corresponde a esta inscrição");
  }
  if (!registration.orderId) {
    return failure(400, "Esta inscrição não pertence a um pedido em grupo");
  }
  if (registration.status !== "PENDING") {
    return failure(
      400,
      "Só é possível sair de um pedido com pagamento pendente"
    );
  }
  const orderId = registration.orderId;

  return withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockRow(tx, "orders", orderId);
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: orderWithRegistrations,
      });
      if (!order) return failure(404, "Pedido não encontrado");
      // Corrida com o webhook: o pedido pode ter sido pago/cancelado entre a
      // leitura inicial e o lock.
      if (order.status !== "PENDING") {
        return failure(409, "Este pedido já foi confirmado ou cancelado");
      }
      const leaving = order.registrations.find((r) => r.id === registrationId);
      if (!leaving || leaving.status !== "PENDING") {
        return failure(409, "Esta inscrição não está mais neste pedido");
      }

      await tx.registration.update({
        where: { id: registrationId },
        data: { orderId: null },
      });

      const remaining = order.registrations.filter(
        (r) => r.id !== registrationId && r.status !== "CANCELLED"
      );
      const previousTotal = order.totalValue;
      const newTotalCents = remaining.reduce(
        (sum, r) => sum + registrationValueCents(order.event, r),
        0
      );
      const cancelled = remaining.length === 0;
      const history = appendHistory(order.paymentDetails, {
        event: "participant_left",
        registrationId,
        at: new Date().toISOString(),
        previousTotal,
        newTotal: newTotalCents / 100,
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: cancelled ? "CANCELLED" : "PENDING",
          totalValue: newTotalCents / 100,
          amountCents: newTotalCents,
          paymentId: null,
          checkoutUrl: null,
          paymentDetails: history,
        },
      });

      return {
        ok: true as const,
        registrationId,
        orderId,
        orderCancelled: cancelled,
        newOrderTotal: newTotalCents / 100,
        remainingParticipants: remaining.length,
        individualAmount:
          registrationValueCents(order.event, leaving) / 100,
      };
    }, TX_OPTIONS)
  );
}

function buildGatewayDetails(parsed: ParsedInfinitePayWebhook, now: Date) {
  return {
    gateway: "INFINITE_PAY",
    orderNsu: parsed.orderNsu,
    transactionNsu: parsed.transactionNsu ?? null,
    invoiceSlug: parsed.invoiceSlug ?? null,
    amount: parsed.amount ?? null,
    paidAmount: parsed.paidAmount ?? null,
    installments: parsed.installments ?? null,
    captureMethod: parsed.captureMethod ?? null,
    receiptUrl: parsed.receiptUrl ?? null,
    dateProcessed: now.toISOString(),
  };
}

/** Campos do pedido ao confirmar o pagamento (lote e camisa avulsa). */
function confirmedOrderData(
  order: { paymentDetails: unknown },
  parsed: ParsedInfinitePayWebhook,
  expectedCents: number,
  gatewayDetails: ReturnType<typeof buildGatewayDetails>,
  now: Date
): Prisma.OrderUpdateInput {
  return {
    status: "CONFIRMED",
    paymentMethod: "INFINITE_PAY",
    paymentId: parsed.transactionNsu ?? parsed.orderNsu,
    paymentError: null,
    transactionNsu: parsed.transactionNsu ?? null,
    invoiceSlug: parsed.invoiceSlug ?? null,
    receiptUrl: parsed.receiptUrl ?? null,
    amountCents: parsed.amount ?? expectedCents,
    paidAmountCents: parsed.paidAmount ?? parsed.amount ?? null,
    paidAt: now,
    paymentDetails: appendHistory(
      { ...(order.paymentDetails as object | null), ...gatewayDetails },
      { event: "payment_confirmed", at: now.toISOString() }
    ),
  };
}

/**
 * Pedido SHIRT_ONLY (compra posterior da camisa), já sob o lock do pedido.
 * Confere o valor contra o recálculo (diferença de preço do lote da inscrição)
 * e, ao confirmar, grava camisa e tamanho na inscrição-alvo. Não toca no
 * pagamento original da inscrição.
 */
async function confirmShirtOrder(
  tx: Tx,
  order: OrderWithRegistrations,
  parsed: ParsedInfinitePayWebhook
): Promise<OrderWebhookResult> {
  const target = order.targetRegistrationId
    ? await tx.registration.findUnique({
        where: { id: order.targetRegistrationId },
        include: { batch: { select: { price: true, priceWithShirt: true } } },
      })
    : null;
  const expectedCents = target
    ? Math.round(resolveShirtOnlyValue(order.event, target.batch) * 100)
    : 0;
  const details = order.paymentDetails as { shirtSize?: unknown } | null;
  const shirtSize =
    typeof details?.shirtSize === "string" ? details.shirtSize : null;

  const ignore = async (reason: string) => {
    console.warn(`⚠️ Pagamento de camisa não aplicado ao pedido ${order.id}: ${reason}`);
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentDetails: appendHistory(order.paymentDetails, {
          event: "stale_payment_received",
          reason,
          at: new Date().toISOString(),
          orderNsu: parsed.orderNsu,
          transactionNsu: parsed.transactionNsu ?? null,
          amountCents: parsed.amount ?? null,
          paidAmountCents: parsed.paidAmount ?? null,
          expectedCents,
        }),
      },
    });
    return {
      status: 200,
      body: {
        received: true,
        status: "IGNORED",
        orderId: order.id,
        message: "Pagamento registrado para conciliação manual",
      },
    };
  };

  if (order.status !== "PENDING") return ignore("order_cancelled");
  if (!target || !shirtSize || expectedCents <= 0) {
    return ignore("unsupported_order");
  }
  if (target.status !== "CONFIRMED") return ignore("registration_not_confirmed");
  if (target.wantsShirt) return ignore("already_has_shirt");

  // O `amount` do webhook é o valor do link gerado: se difere do valor atual,
  // o link é anterior a uma mudança de preço.
  const staleLink =
    typeof parsed.amount === "number"
      ? Math.abs(parsed.amount - expectedCents) > 1
      : order.paymentId === null;
  if (staleLink) return ignore("stale_link");

  const paidCents = parsed.paidAmount ?? parsed.amount;
  if (typeof paidCents === "number" && paidCents + 1 < expectedCents) {
    console.warn(
      `⚠️ Valor InfinitePay abaixo do esperado (pago ${paidCents}, esperado ${expectedCents}) para o pedido ${order.id}`
    );
    return { status: 422, body: { error: "Valor pago inferior ao esperado" } };
  }

  const now = new Date();
  await tx.order.update({
    where: { id: order.id },
    data: confirmedOrderData(
      order,
      parsed,
      expectedCents,
      buildGatewayDetails(parsed, now),
      now
    ),
  });
  await tx.registration.update({
    where: { id: target.id },
    data: { wantsShirt: true, shirtSize },
  });

  console.log(`✅ Camisa do pedido ${order.id} confirmada via InfinitePay`);
  return {
    status: 200,
    body: {
      received: true,
      status: "CONFIRMED",
      orderId: order.id,
      registrationId: target.id,
    },
  };
}

export interface OrderWebhookResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Webhook do InfinitePay para order_nsu "ord_<id>". Sob lock do pedido:
 * idempotente, recusa pagamento de link obsoleto (9.7) e valor pago menor que
 * o recalculado, e confirma pedido + inscrições na mesma transação.
 */
export async function confirmOrderFromWebhook(
  parsed: ParsedInfinitePayWebhook
): Promise<OrderWebhookResult> {
  const orderId = parseOrderNsu(parsed.orderNsu);

  return withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockRow(tx, "orders", orderId);
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: orderWithRegistrations,
      });

      if (!order) {
        console.error("Pedido não encontrado para order_nsu:", parsed.orderNsu);
        return {
          status: 404,
          body: { error: "Order not found", orderNsu: parsed.orderNsu },
        };
      }

      if (order.status === "CONFIRMED") {
        return {
          status: 200,
          body: {
            received: true,
            status: "CONFIRMED",
            orderId: order.id,
            message: "Já confirmado",
          },
        };
      }

      if (order.type === "SHIRT_ONLY") {
        return confirmShirtOrder(tx, order, parsed);
      }

      const snapshot = buildOrderSnapshot(order);
      const paidCents = parsed.paidAmount ?? parsed.amount;
      const staleEntry = (reason: string) =>
        appendHistory(order.paymentDetails, {
          event: "stale_payment_received",
          reason,
          at: new Date().toISOString(),
          orderNsu: parsed.orderNsu,
          transactionNsu: parsed.transactionNsu ?? null,
          amountCents: parsed.amount ?? null,
          paidAmountCents: parsed.paidAmount ?? null,
          expectedCents: snapshot.totalCents,
        });

      const ignore = async (reason: string, message: string) => {
        console.warn(`⚠️ Pagamento não aplicado ao pedido ${order.id}: ${reason}`);
        await tx.order.update({
          where: { id: order.id },
          data: { paymentDetails: staleEntry(reason) },
        });
        return {
          status: 200,
          body: {
            received: true,
            status: "IGNORED",
            orderId: order.id,
            message,
          },
        };
      };

      if (order.type !== "BATCH" || snapshot.active.length === 0) {
        return ignore(
          order.status === "CANCELLED" ? "order_cancelled" : "unsupported_order",
          "Pedido não está apto a receber pagamento; registrado para conciliação manual"
        );
      }

      // Salvaguarda 9.7: o `amount` do webhook é o valor do link que geramos.
      // Se difere do total atual, o link é anterior a uma saída/recálculo.
      // (O transaction_nsu só existe após o pagamento, então não serve de
      // referência do link.) Sem `amount`, vale a invalidação do paymentId.
      const staleLink =
        typeof parsed.amount === "number"
          ? Math.abs(parsed.amount - snapshot.totalCents) > 1
          : order.paymentId === null;
      if (staleLink) {
        return ignore(
          "stale_link",
          "Link de pagamento obsoleto; registrado para conciliação manual"
        );
      }

      if (
        typeof paidCents === "number" &&
        paidCents + 1 < snapshot.totalCents
      ) {
        console.warn(
          `⚠️ Valor InfinitePay abaixo do esperado (pago ${paidCents}, esperado ${snapshot.totalCents}) para o pedido ${order.id}`
        );
        return {
          status: 422,
          body: { error: "Valor pago inferior ao esperado" },
        };
      }

      const reference = parsed.transactionNsu ?? parsed.orderNsu;
      const now = new Date();
      const gatewayDetails = buildGatewayDetails(parsed, now);

      await tx.order.update({
        where: { id: order.id },
        data: confirmedOrderData(
          order,
          parsed,
          snapshot.totalCents,
          gatewayDetails,
          now
        ),
      });
      await tx.registration.updateMany({
        where: { orderId: order.id, status: { not: "CANCELLED" } },
        data: {
          status: "CONFIRMED",
          paymentMethod: "INFINITE_PAY",
          paymentId: reference,
          paymentError: null,
          paymentDetails: { ...gatewayDetails, orderId: order.id },
        },
      });

      console.log(
        `✅ Pedido ${order.id} confirmado via InfinitePay (${snapshot.active.length} inscrições)`
      );
      return {
        status: 200,
        body: {
          received: true,
          status: "CONFIRMED",
          orderId: order.id,
          registrations: snapshot.active.length,
        },
      };
    }, TX_OPTIONS)
  );
}
