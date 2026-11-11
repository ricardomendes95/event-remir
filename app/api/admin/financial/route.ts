import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { canViewFinancialValues } from "@/lib/permissions";
import { loadBreakdownInputs } from "@/backend/utils/financialData";
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

    const { registrations, items, shirtOrders, eventInfo } =
      await loadBreakdownInputs({ registrationWhere, shirtOrderWhere, eventScope });

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
