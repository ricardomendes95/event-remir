import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { canViewFinancialValues } from "@/lib/permissions";
import {
  buildFinancialSummary,
  buildRows,
  type BreakdownRegistration,
  type FinancialSummary,
} from "@/backend/utils/revenueBreakdown";

function parseRange(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  end.setHours(23, 59, 59, 999);
  return { gte: start, lte: end };
}

export async function GET(request: NextRequest) {
  try {
    if (!canViewFinancialValues(request.headers.get("x-user-role"))) {
      return NextResponse.json(
        { success: false, error: "Acesso negado" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const format = searchParams.get("format");
    const range = parseRange(
      searchParams.get("startDate"),
      searchParams.get("endDate")
    );
    const eventScope = eventId && eventId !== "ALL" ? eventId : null;

    const registrationWhere: Prisma.RegistrationWhereInput = {
      ...(range ? { createdAt: range } : {}),
      ...(eventScope ? { eventId: eventScope } : {}),
    };
    const shirtOrderWhere: Prisma.OrderWhereInput = {
      type: "SHIRT_ONLY",
      status: "CONFIRMED",
      ...(range ? { createdAt: range } : {}),
      ...(eventScope ? { eventId: eventScope } : {}),
    };

    const [registrations, shirtOrders, shirtTargets, eventInfo] = await withPrismaRetry(
      async () =>
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

    if (format === "export") {
      const eventTitles = new Map(items.map((i) => [i.event.id, i.event.title]));
      const rows = buildRows(items).filter((row) => row.counted);
      return NextResponse.json({
        success: true,
        data: {
          summary: buildFinancialSummary(items, shirtOrders),
          rows,
          shirtOrders: shirtOrders.map((o) => ({
            id: o.id,
            eventTitle: eventTitles.get(o.eventId) ?? "",
            amount: o.totalValue,
          })),
        },
      });
    }

    const eventGroups = new Map<string, BreakdownRegistration[]>();
    for (const item of items) {
      const group = eventGroups.get(item.event.id) ?? [];
      group.push(item);
      eventGroups.set(item.event.id, group);
    }
    const eventDates = new Map(
      registrations.map((r) => [r.event.id, r.event.startDate.toISOString()])
    );

    const compact = (s: FinancialSummary) => ({
      confirmedRegistrations: s.confirmedRegistrations,
      pendingRegistrations: s.pendingRegistrations,
      pendingAmount: s.pendingAmount,
      gross: s.gross,
      shirtRevenue: s.shirtRevenue,
      fees: s.fees,
      refunds: s.refunds.amount,
      net: s.net,
    });

    const byEvent = Array.from(eventGroups.entries())
      .map(([id, group]) => ({
        eventId: id,
        eventTitle: group[0].event.title,
        eventDate: eventDates.get(id) ?? null,
        ...compact(
          buildFinancialSummary(
            group,
            shirtOrders.filter((o) => o.eventId === id)
          )
        ),
      }))
      .sort((a, b) => b.gross - a.gross);

    return NextResponse.json({
      success: true,
      data: {
        scope: {
          eventId: eventScope,
          eventTitle: eventInfo?.title ?? null,
          eventDate: eventInfo?.startDate.toISOString() ?? null,
        },
        summary: buildFinancialSummary(items, shirtOrders),
        byEvent,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar dados financeiros:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
