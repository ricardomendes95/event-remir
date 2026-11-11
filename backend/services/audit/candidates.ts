import { prisma, withPrismaRetry } from "@/lib/prisma";
import { resolvePaymentDate } from "@/backend/utils/paymentDate";
import type { PaymentChannel, ReconcileCandidate } from "./reconcile";

/** Candidato + dados de exibição (nunca vão para o matching). */
export interface CandidateView extends ReconcileCandidate {
  kind: "REGISTRATION" | "ORDER";
  registrationId: string | null;
  orderId: string | null;
  label: string;
  eventTitle: string;
  displayAmountCents: number;
  /** Tem dados suficientes para consulta pontual (payment_check). */
  checkable: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Pagamento pode acontecer bem depois da criação (link reaproveitado)
const LOOKBACK_DAYS = 90;

function channelOf(details: Record<string, unknown> | null): PaymentChannel {
  const method = String(details?.captureMethod ?? "").toLowerCase();
  if (!method) return "UNKNOWN";
  if (method.includes("pix")) return "PIX";
  if (method.includes("credit") || method.includes("card")) return "CREDIT";
  return "UNKNOWN";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function amountsFrom(
  details: Record<string, unknown> | null,
  extra: Array<number | null | undefined>
): number[] {
  const list = [details?.paidAmount, details?.amount, ...extra].filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0
  );
  return Array.from(new Set(list.map((v) => Math.round(v))));
}

/**
 * Pagamentos InfinitePay confirmados que podem aparecer no extrato do período.
 * Pedidos (grupo/camisa) são um candidato só; inscrições de um pedido não entram
 * sozinhas. `linkedIds` marca como `consumed` o que já foi vinculado antes.
 */
export async function loadCandidates(
  period: { start: Date; end: Date },
  linkedIds: Set<string>
): Promise<CandidateView[]> {
  const createdFrom = new Date(period.start.getTime() - LOOKBACK_DAYS * DAY_MS);
  const windowStart = period.start.getTime() - DAY_MS;
  const windowEnd = period.end.getTime() + DAY_MS;

  const [registrations, orders] = await withPrismaRetry(async () =>
    Promise.all([
      prisma.registration.findMany({
        where: {
          orderId: null,
          paymentMethod: "INFINITE_PAY",
          createdAt: { gte: createdFrom, lte: new Date(windowEnd) },
          OR: [
            { status: "CONFIRMED" },
            { status: "CANCELLED", refundRequests: { some: { resolution: "REFUNDED" } } },
          ],
        },
        select: {
          id: true,
          name: true,
          status: true,
          paymentDetails: true,
          updatedAt: true,
          event: { select: { title: true } },
        },
      }),
      prisma.order.findMany({
        where: {
          status: "CONFIRMED",
          paymentMethod: "INFINITE_PAY",
          createdAt: { gte: createdFrom, lte: new Date(windowEnd) },
        },
        select: {
          id: true,
          type: true,
          totalValue: true,
          amountCents: true,
          paidAmountCents: true,
          paidAt: true,
          paymentDetails: true,
          transactionNsu: true,
          invoiceSlug: true,
          targetRegistrationId: true,
          updatedAt: true,
          event: { select: { title: true } },
          registrations: { select: { name: true }, orderBy: { createdAt: "asc" } },
        },
      }),
    ])
  );

  const targetIds = orders
    .map((o) => o.targetRegistrationId)
    .filter((id): id is string => !!id);
  const targets = targetIds.length
    ? await withPrismaRetry(() =>
        prisma.registration.findMany({
          where: { id: { in: targetIds } },
          select: { id: true, name: true },
        })
      )
    : [];
  const targetName = new Map(targets.map((t) => [t.id, t.name]));

  const result: CandidateView[] = [];

  for (const reg of registrations) {
    const details = asRecord(reg.paymentDetails);
    const exactIso = resolvePaymentDate(reg.paymentDetails);
    const paidAt = exactIso ? new Date(exactIso) : reg.updatedAt;
    const amounts = amountsFrom(details, []);
    const id = `registration:${reg.id}`;
    result.push({
      id,
      kind: "REGISTRATION",
      registrationId: reg.id,
      orderId: null,
      names: [reg.name],
      amountsCents: amounts,
      paidAt,
      paidAtExact: !!exactIso,
      channel: channelOf(details),
      consumed: linkedIds.has(id),
      refunded: reg.status === "CANCELLED",
      label: reg.name,
      eventTitle: reg.event.title,
      displayAmountCents: amounts[0] ?? 0,
      checkable: !!details?.transactionNsu && !!details?.invoiceSlug,
    });
  }

  for (const order of orders) {
    const details = asRecord(order.paymentDetails);
    const exactIso = order.paidAt?.toISOString() ?? resolvePaymentDate(order.paymentDetails);
    const paidAt = exactIso ? new Date(exactIso) : order.updatedAt;
    const names = order.registrations.map((r) => r.name);
    if (order.targetRegistrationId && targetName.has(order.targetRegistrationId)) {
      names.push(targetName.get(order.targetRegistrationId)!);
    }
    const amounts = amountsFrom(details, [
      order.paidAmountCents,
      order.amountCents,
      Math.round(order.totalValue * 100),
    ]);
    const id = `order:${order.id}`;
    const people = order.type === "SHIRT_ONLY" ? "Camisa" : `Grupo (${order.registrations.length})`;
    result.push({
      id,
      kind: "ORDER",
      registrationId: null,
      orderId: order.id,
      names,
      amountsCents: amounts,
      paidAt,
      paidAtExact: !!exactIso,
      channel: channelOf(details),
      consumed: linkedIds.has(id),
      label: `${people} · ${names[0] ?? "sem nome"}`,
      eventTitle: order.event.title,
      displayAmountCents: order.paidAmountCents ?? order.amountCents ?? Math.round(order.totalValue * 100),
      checkable: !!(order.transactionNsu ?? details?.transactionNsu) && !!(order.invoiceSlug ?? details?.invoiceSlug),
    });
  }

  return result.filter(
    (c) => c.paidAt && c.paidAt.getTime() >= windowStart && c.paidAt.getTime() <= windowEnd
  );
}
