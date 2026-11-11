import { Prisma } from "@prisma/client";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import type { BreakdownRegistration } from "@/backend/utils/revenueBreakdown";

interface LoadParams {
  registrationWhere: Prisma.RegistrationWhereInput;
  shirtOrderWhere: Prisma.OrderWhereInput;
  eventScope: string | null;
}

/**
 * Carrega e normaliza os insumos de `revenueBreakdown` (fonte única da receita).
 * Usado pelo Financeiro e pelo dashboard para os números baterem.
 */
export async function loadBreakdownInputs({
  registrationWhere,
  shirtOrderWhere,
  eventScope,
}: LoadParams) {
  const [registrations, shirtOrders, shirtTargets, eventInfo] =
    await withPrismaRetry(async () =>
      Promise.all([
        prisma.registration.findMany({
          where: registrationWhere,
          select: {
            id: true,
            name: true,
            status: true,
            paymentMethod: true,
            manualPaymentType: true,
            cashResponsible: true,
            wantsShirt: true,
            orderId: true,
            paymentDetails: true,
            createdAt: true,
            event: {
              select: {
                id: true,
                title: true,
                price: true,
                startDate: true,
                shirtConfig: true,
              },
            },
            batch: {
              select: {
                id: true,
                name: true,
                price: true,
                priceWithShirt: true,
              },
            },
            refundRequests: {
              where: { resolution: "REFUNDED" },
              select: { refundedAmount: true, refundedAt: true },
            },
          },
        }),
        prisma.order.findMany({
          where: shirtOrderWhere,
          select: {
            id: true,
            eventId: true,
            totalValue: true,
            paymentDetails: true,
          },
        }),
        // Inscrições que compraram a camisa depois (qualquer data): o valor
        // da camisa entra só pelo pedido avulso, nunca duplicado na inscrição.
        prisma.order.findMany({
          where: {
            type: "SHIRT_ONLY",
            status: "CONFIRMED",
            ...(eventScope ? { eventId: eventScope } : {}),
          },
          select: { targetRegistrationId: true },
        }),
        eventScope
          ? prisma.event.findUnique({
              where: { id: eventScope },
              select: { id: true, title: true, startDate: true },
            })
          : Promise.resolve(null),
      ])
    );

  const boughtShirtLater = new Set(
    shirtTargets.map((o) => o.targetRegistrationId).filter(Boolean)
  );

  const items: BreakdownRegistration[] = registrations.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    paymentMethod: r.paymentMethod,
    manualPaymentType: r.manualPaymentType,
    cashResponsible: r.cashResponsible,
    wantsShirt: boughtShirtLater.has(r.id) ? false : r.wantsShirt,
    orderId: r.orderId,
    paymentDetails: r.paymentDetails,
    createdAt: r.createdAt,
    event: {
      id: r.event.id,
      title: r.event.title,
      price: Number(r.event.price),
      shirtConfig: r.event.shirtConfig,
    },
    batch: r.batch,
    refunds: r.refundRequests
      .filter((q) => (q.refundedAmount ?? 0) > 0)
      .map((q) => ({
        amount: q.refundedAmount ?? 0,
        refundedAt: q.refundedAt,
      })),
  }));

  return { registrations, items, shirtOrders, eventInfo };
}
