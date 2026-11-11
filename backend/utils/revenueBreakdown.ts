import { INFINITEPAY } from "@/backend/utils/paymentFees";
import { getShirtConfig, resolveBaseValue } from "@/backend/utils/shirtPricing";
import { resolvePaymentDate } from "@/backend/utils/paymentDate";

/**
 * Fonte única dos números do financeiro (tela, impressão e CSV).
 *
 * Regras (ADR-003/Q13, RFC 10):
 * - Receita = inscrições CONFIRMED + inscrições canceladas com estorno concluído
 *   (o dinheiro entrou; o estorno sai à parte). O pedido em grupo (Order) não é
 *   somado de novo: a receita é sempre a soma das inscrições dele.
 * - Camisa = (valor com camisa − valor sem camisa) do lote da inscrição, ou do
 *   evento quando não há lote. Camisa avulsa (Order SHIRT_ONLY) soma à parte.
 * - Taxas são ESTIMATIVA pela tabela de referência (paymentFees); o valor real
 *   depende da conta InfinitePay.
 */

export type MethodKey =
  | "INFINITE_PAY"
  | "MANUAL_PIX"
  | "MANUAL_CASH"
  | "MANUAL_CARD"
  | "MANUAL_UNSPECIFIED";

export const METHOD_ORDER: MethodKey[] = [
  "INFINITE_PAY",
  "MANUAL_PIX",
  "MANUAL_CASH",
  "MANUAL_CARD",
  "MANUAL_UNSPECIFIED",
];

export type GatewayChannel =
  | "PIX"
  | "CREDIT_1X"
  | "CREDIT_INSTALLMENTS"
  | "UNKNOWN";

export const GATEWAY_CHANNEL_ORDER: GatewayChannel[] = [
  "PIX",
  "CREDIT_1X",
  "CREDIT_INSTALLMENTS",
  "UNKNOWN",
];

export interface BreakdownRegistration {
  id: string;
  name: string;
  status: string;
  paymentMethod: string;
  manualPaymentType: string | null;
  cashResponsible: string | null;
  wantsShirt: boolean | null;
  orderId: string | null;
  paymentDetails: unknown;
  createdAt: Date;
  event: { id: string; title: string; price: number; shirtConfig: unknown };
  batch: {
    id: string;
    name: string;
    price: number;
    priceWithShirt: number | null;
  } | null;
  /** Estornos concluídos (RefundRequest com resolução REFUNDED). */
  refunds: { amount: number; refundedAt: Date | null }[];
}

export interface StandaloneShirtOrder {
  id: string;
  eventId: string;
  totalValue: number;
  paymentDetails: unknown;
}

export interface Amounts {
  total: number;
  inscription: number;
  shirt: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Decompõe o valor de uma inscrição em inscrição + camisa (D4/Q13). */
export function decomposeRegistration(reg: BreakdownRegistration): Amounts {
  if (reg.paymentMethod === "FREE") {
    return { total: 0, inscription: 0, shirt: 0 };
  }
  const event = { price: reg.event.price, shirtConfig: reg.event.shirtConfig };
  const total = resolveBaseValue(event, reg.wantsShirt ?? false, reg.batch);
  const basePrice = reg.batch ? reg.batch.price : reg.event.price;
  const hasShirt = !!reg.wantsShirt && getShirtConfig(event) !== null;
  const shirt = hasShirt ? Math.max(0, round2(total - basePrice)) : 0;
  return { total, inscription: round2(total - shirt), shirt };
}

export function hasShirtSelected(reg: BreakdownRegistration): boolean {
  return !!reg.wantsShirt && getShirtConfig(reg.event) !== null;
}

export function methodOf(reg: BreakdownRegistration): MethodKey | null {
  if (reg.paymentMethod === "FREE") return null;
  if (reg.paymentMethod === "MANUAL") {
    if (reg.manualPaymentType === "PIX") return "MANUAL_PIX";
    if (reg.manualPaymentType === "CASH") return "MANUAL_CASH";
    if (reg.manualPaymentType === "CARD") return "MANUAL_CARD";
    return "MANUAL_UNSPECIFIED";
  }
  return "INFINITE_PAY"; // inclui o legado Mercado Pago
}

/** Forma usada no checkout do gateway, lida do payload gravado pelo webhook. */
export function gatewayChannelOf(paymentDetails: unknown): GatewayChannel {
  if (!paymentDetails || typeof paymentDetails !== "object") return "UNKNOWN";
  const d = paymentDetails as Record<string, unknown>;
  const capture = String(d.captureMethod ?? "").toLowerCase();
  const installments = Number(d.installments ?? 0);
  if (capture.includes("pix")) return "PIX";
  if (capture.includes("credit")) {
    return installments > 1 ? "CREDIT_INSTALLMENTS" : "CREDIT_1X";
  }
  return "UNKNOWN";
}

/**
 * Taxa estimada (referência). Parcelado usa o piso da faixa de referência,
 * por isso o valor é uma estimativa mínima.
 */
export function estimateFee(channel: GatewayChannel, amount: number): number {
  const fees = INFINITEPAY.referenceFees;
  const rate =
    channel === "PIX"
      ? fees.pix
      : channel === "CREDIT_1X"
        ? fees.credit_1x
        : channel === "CREDIT_INSTALLMENTS"
          ? fees.credit_min_parcelado
          : 0;
  return round2(amount * rate);
}

export interface MoneyLine {
  registrations: number;
  gross: number;
  shirt: number;
  fees: number;
  refunds: number;
  net: number;
}

const emptyLine = (): MoneyLine => ({
  registrations: 0,
  gross: 0,
  shirt: 0,
  fees: 0,
  refunds: 0,
  net: 0,
});

function finalize(line: MoneyLine): MoneyLine {
  const gross = round2(line.gross);
  const fees = round2(line.fees);
  const refunds = round2(line.refunds);
  return {
    registrations: line.registrations,
    gross,
    shirt: round2(line.shirt),
    fees,
    refunds,
    net: round2(gross - fees - refunds),
  };
}

export interface RegistrationRow {
  id: string;
  eventId: string;
  eventTitle: string;
  name: string;
  status: string;
  /** Entra nos totais de receita (confirmada ou cancelada com estorno). */
  counted: boolean;
  method: MethodKey | "FREE";
  channel: GatewayChannel | null;
  cashResponsible: string | null;
  batchName: string | null;
  orderId: string | null;
  wantsShirt: boolean;
  inscription: number;
  shirt: number;
  total: number;
  fee: number;
  refunded: number;
  paymentDate: string | null;
  createdAt: string;
}

export interface FinancialSummary {
  /** Inscritos confirmados (gratuitos inclusos). */
  confirmedRegistrations: number;
  withShirt: number;
  withoutShirt: number;
  /** O(s) evento(s) do recorte oferecem camisa. */
  hasShirtOffer: boolean;
  pendingRegistrations: number;
  pendingAmount: number;
  cancelledRegistrations: number;
  /** Receita bruta contabilizada = inscrições + camisas. */
  gross: number;
  inscriptionRevenue: number;
  shirtRevenue: number;
  standaloneShirts: { count: number; amount: number };
  fees: number;
  refunds: { count: number; amount: number };
  net: number;
  byMethod: Record<MethodKey, MoneyLine>;
  byChannel: Record<GatewayChannel, MoneyLine>;
  cashResponsibles: {
    name: string;
    registrations: number;
    gross: number;
    refunds: number;
    inHand: number;
  }[];
  byBatch: {
    batchId: string | null;
    name: string;
    registrations: number;
    withShirt: number;
    gross: number;
    shirt: number;
  }[];
  refundList: {
    registrationId: string;
    name: string;
    eventTitle: string;
    amount: number;
    refundedAt: string | null;
  }[];
  /** Canceladas sem estorno que tinham pagamento online (valor retido). */
  retainedAfterCancel: { count: number; amount: number };
  /** Total registrado pela InfinitePay (pedido contado uma vez). */
  gatewayReported: number;
}

const NO_BATCH_NAME = "Sem lote";

export function emptyMethodMap(): Record<MethodKey, MoneyLine> {
  return Object.fromEntries(
    METHOD_ORDER.map((m) => [m, emptyLine()])
  ) as Record<MethodKey, MoneyLine>;
}

function emptyChannelMap(): Record<GatewayChannel, MoneyLine> {
  return Object.fromEntries(
    GATEWAY_CHANNEL_ORDER.map((c) => [c, emptyLine()])
  ) as Record<GatewayChannel, MoneyLine>;
}

/** Valor pago registrado pelo gateway, em reais (o webhook grava em centavos). */
function reportedByGateway(paymentDetails: unknown): number {
  if (!paymentDetails || typeof paymentDetails !== "object") return 0;
  const d = paymentDetails as Record<string, unknown>;
  const cents = Number(d.paidAmount ?? d.amount ?? 0);
  return Number.isFinite(cents) && cents > 0 ? cents / 100 : 0;
}

export function buildRows(
  registrations: BreakdownRegistration[]
): RegistrationRow[] {
  return registrations.map((reg) => {
    const refundedTotal = round2(
      reg.refunds.reduce((s, r) => s + r.amount, 0)
    );
    const counted =
      reg.status === "CONFIRMED" ||
      (reg.status === "CANCELLED" && refundedTotal > 0);
    const method = methodOf(reg);
    const amounts = decomposeRegistration(reg);
    const channel = method === "INFINITE_PAY" ? gatewayChannelOf(reg.paymentDetails) : null;
    return {
      id: reg.id,
      eventId: reg.event.id,
      eventTitle: reg.event.title,
      name: reg.name,
      status: reg.status,
      counted: counted && method !== null,
      method: method ?? "FREE",
      channel,
      cashResponsible: reg.cashResponsible,
      batchName: reg.batch?.name ?? null,
      orderId: reg.orderId,
      wantsShirt: hasShirtSelected(reg),
      inscription: amounts.inscription,
      shirt: amounts.shirt,
      total: amounts.total,
      fee:
        counted && channel ? estimateFee(channel, amounts.total) : 0,
      refunded: refundedTotal,
      paymentDate: resolvePaymentDate(reg.paymentDetails),
      createdAt: reg.createdAt.toISOString(),
    };
  });
}

export function buildFinancialSummary(
  registrations: BreakdownRegistration[],
  shirtOrders: StandaloneShirtOrder[] = []
): FinancialSummary {
  const rows = buildRows(registrations);
  const byId = new Map(registrations.map((r) => [r.id, r]));

  const byMethod = emptyMethodMap();
  const byChannel = emptyChannelMap();
  const cash = new Map<
    string,
    { name: string; registrations: number; gross: number; refunds: number }
  >();
  const batches = new Map<
    string,
    {
      batchId: string | null;
      name: string;
      registrations: number;
      withShirt: number;
      gross: number;
      shirt: number;
    }
  >();
  const refundList: FinancialSummary["refundList"] = [];

  let confirmed = 0;
  let withShirt = 0;
  let pending = 0;
  let pendingAmount = 0;
  let cancelled = 0;
  let retainedCount = 0;
  let retainedAmount = 0;
  let refundCount = 0;
  let hasShirtOffer = false;
  const seenOrders = new Set<string>();
  let gatewayReported = 0;

  for (const row of rows) {
    const reg = byId.get(row.id)!;
    if (getShirtConfig(reg.event)) hasShirtOffer = true;

    if (row.status === "CONFIRMED") {
      confirmed += 1;
      if (row.wantsShirt) withShirt += 1;
    } else if (row.status === "PENDING") {
      pending += 1;
      if (row.method !== "FREE") pendingAmount += row.total;
    } else if (row.status === "CANCELLED") {
      cancelled += 1;
      if (
        !row.counted &&
        row.method === "INFINITE_PAY" &&
        row.paymentDate !== null
      ) {
        retainedCount += 1;
        retainedAmount += row.total;
      }
    }

    if (!row.counted || row.method === "FREE") continue;

    const methodLine = byMethod[row.method];
    methodLine.registrations += 1;
    methodLine.gross += row.total;
    methodLine.shirt += row.shirt;
    methodLine.fees += row.fee;
    methodLine.refunds += row.refunded;

    if (row.channel) {
      const line = byChannel[row.channel];
      line.registrations += 1;
      line.gross += row.total;
      line.shirt += row.shirt;
      line.fees += row.fee;
      line.refunds += row.refunded;
    }

    if (row.method === "MANUAL_CASH") {
      const name = row.cashResponsible?.trim() || "Sem responsável informado";
      const entry = cash.get(name) ?? {
        name,
        registrations: 0,
        gross: 0,
        refunds: 0,
      };
      entry.registrations += 1;
      entry.gross += row.total;
      entry.refunds += row.refunded;
      cash.set(name, entry);
    }

    const batchKey = reg.batch?.id ?? "none";
    const batch = batches.get(batchKey) ?? {
      batchId: reg.batch?.id ?? null,
      name: reg.batch?.name ?? NO_BATCH_NAME,
      registrations: 0,
      withShirt: 0,
      gross: 0,
      shirt: 0,
    };
    batch.registrations += 1;
    if (row.wantsShirt) batch.withShirt += 1;
    batch.gross += row.total;
    batch.shirt += row.shirt;
    batches.set(batchKey, batch);

    if (row.refunded > 0) {
      refundCount += 1;
      refundList.push({
        registrationId: row.id,
        name: row.name,
        eventTitle: row.eventTitle,
        amount: row.refunded,
        refundedAt:
          reg.refunds
            .map((r) => r.refundedAt)
            .filter((d): d is Date => !!d)
            .sort((a, b) => b.getTime() - a.getTime())[0]
            ?.toISOString() ?? null,
      });
    }

    // Valor que a InfinitePay diz ter recebido: pedido em grupo conta uma vez.
    if (row.method === "INFINITE_PAY") {
      if (reg.orderId) {
        if (!seenOrders.has(reg.orderId)) {
          seenOrders.add(reg.orderId);
          gatewayReported += reportedByGateway(reg.paymentDetails);
        }
      } else {
        gatewayReported += reportedByGateway(reg.paymentDetails);
      }
    }
  }

  // Camisa avulsa (Order SHIRT_ONLY): receita só de camisa, via gateway.
  let standaloneAmount = 0;
  for (const order of shirtOrders) {
    const channel = gatewayChannelOf(order.paymentDetails);
    const fee = estimateFee(channel, order.totalValue);
    standaloneAmount += order.totalValue;
    for (const line of [byMethod.INFINITE_PAY, byChannel[channel]]) {
      line.gross += order.totalValue;
      line.shirt += order.totalValue;
      line.fees += fee;
    }
    gatewayReported += reportedByGateway(order.paymentDetails);
  }

  const methodFinal = Object.fromEntries(
    METHOD_ORDER.map((m) => [m, finalize(byMethod[m])])
  ) as Record<MethodKey, MoneyLine>;
  const channelFinal = Object.fromEntries(
    GATEWAY_CHANNEL_ORDER.map((c) => [c, finalize(byChannel[c])])
  ) as Record<GatewayChannel, MoneyLine>;

  const lines = Object.values(methodFinal);
  const gross = round2(lines.reduce((s, l) => s + l.gross, 0));
  const shirtRevenue = round2(lines.reduce((s, l) => s + l.shirt, 0));
  const fees = round2(lines.reduce((s, l) => s + l.fees, 0));
  const refundsAmount = round2(lines.reduce((s, l) => s + l.refunds, 0));

  return {
    confirmedRegistrations: confirmed,
    withShirt,
    withoutShirt: confirmed - withShirt,
    hasShirtOffer,
    pendingRegistrations: pending,
    pendingAmount: round2(pendingAmount),
    cancelledRegistrations: cancelled,
    gross,
    inscriptionRevenue: round2(gross - shirtRevenue),
    shirtRevenue,
    standaloneShirts: {
      count: shirtOrders.length,
      amount: round2(standaloneAmount),
    },
    fees,
    refunds: { count: refundCount, amount: refundsAmount },
    net: round2(gross - fees - refundsAmount),
    byMethod: methodFinal,
    byChannel: channelFinal,
    cashResponsibles: Array.from(cash.values())
      .map((c) => ({
        name: c.name,
        registrations: c.registrations,
        gross: round2(c.gross),
        refunds: round2(c.refunds),
        inHand: round2(c.gross - c.refunds),
      }))
      .sort((a, b) => b.inHand - a.inHand),
    byBatch: Array.from(batches.values())
      .map((b) => ({ ...b, gross: round2(b.gross), shirt: round2(b.shirt) }))
      .sort((a, b) => b.gross - a.gross),
    refundList: refundList.sort((a, b) =>
      (b.refundedAt ?? "").localeCompare(a.refundedAt ?? "")
    ),
    retainedAfterCancel: {
      count: retainedCount,
      amount: round2(retainedAmount),
    },
    gatewayReported: round2(gatewayReported),
  };
}
