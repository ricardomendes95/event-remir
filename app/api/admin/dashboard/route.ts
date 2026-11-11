import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { canViewFinancialValues } from "@/lib/permissions";
import { OCCUPYING_STATUSES } from "@/backend/utils/eventBatches";
import { getShirtConfig } from "@/backend/utils/shirtPricing";
import { loadBreakdownInputs } from "@/backend/utils/financialData";
import { buildFinancialSummary } from "@/backend/utils/revenueBreakdown";

/**
 * Dashboard do evento selecionado (Q15, ADR-003): por padrão o evento ativo
 * mais recente. Valores financeiros só saem para SUPER_ADMIN/ADMIN — para os
 * demais perfis o payload nem contém os campos (ADR-002).
 */
export async function GET(request: NextRequest) {
  try {
    const showFinancials = canViewFinancialValues(
      request.headers.get("x-user-role")
    );
    const requestedEventId = new URL(request.url).searchParams.get("eventId");

    const events = await withPrismaRetry(() =>
      prisma.event.findMany({
        select: {
          id: true,
          title: true,
          startDate: true,
          isActive: true,
          isFree: true,
          maxParticipants: true,
          shirtConfig: true,
        },
        orderBy: { startDate: "desc" },
        take: 100,
      })
    );

    const selected =
      events.find((e) => e.id === requestedEventId) ??
      events.find((e) => e.isActive) ??
      events[0] ??
      null;

    const eventList = events.map((e) => ({
      id: e.id,
      title: e.title,
      startDate: e.startDate.toISOString(),
      isActive: e.isActive,
    }));

    if (!selected) {
      return NextResponse.json({
        success: true,
        data: { events: eventList, selectedEventId: null, event: null },
      });
    }

    const eventId = selected.id;
    const baseWhere: Prisma.RegistrationWhereInput = { eventId };

    const [grouped, checkedIn, shirtGroups, recent] = await withPrismaRetry(() =>
      Promise.all([
        prisma.registration.groupBy({
          by: ["status"],
          where: baseWhere,
          _count: { _all: true },
        }),
        prisma.registration.count({
          where: { ...baseWhere, status: "CONFIRMED", checkedInAt: { not: null } },
        }),
        prisma.registration.groupBy({
          by: ["shirtSize"],
          where: { ...baseWhere, status: "CONFIRMED", wantsShirt: true },
          _count: { _all: true },
        }),
        prisma.registration.findMany({
          where: baseWhere,
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            status: true,
            paymentMethod: true,
            createdAt: true,
          },
        }),
      ])
    );

    const count = (status: string) =>
      grouped.find((g) => g.status === status)?._count._all ?? 0;
    const confirmed = count("CONFIRMED");
    const pending = count("PENDING");
    const cancelled = count("CANCELLED") + count("PAYMENT_FAILED");
    const total = grouped.reduce((sum, g) => sum + g._count._all, 0);
    const occupied = (OCCUPYING_STATUSES as readonly string[]).reduce(
      (sum, s) => sum + count(s),
      0
    );

    const shirtsBySize = shirtGroups
      .map((g) => ({ size: g.shirtSize ?? "Sem tamanho", count: g._count._all }))
      .sort((a, b) => b.count - a.count);

    let financial: {
      net: number;
      gross: number;
      openRefunds: number;
    } | null = null;

    if (showFinancials) {
      const [inputs, openRefunds] = await Promise.all([
        loadBreakdownInputs({
          registrationWhere: baseWhere,
          shirtOrderWhere: { type: "SHIRT_ONLY", status: "CONFIRMED", eventId },
          eventScope: eventId,
        }),
        withPrismaRetry(() =>
          prisma.refundRequest.count({
            where: {
              status: { in: ["OPEN", "IN_CONTACT"] },
              registration: baseWhere,
            },
          })
        ),
      ]);
      const summary = buildFinancialSummary(inputs.items, inputs.shirtOrders);
      financial = { net: summary.net, gross: summary.gross, openRefunds };
    }

    return NextResponse.json({
      success: true,
      data: {
        events: eventList,
        selectedEventId: eventId,
        event: {
          id: eventId,
          title: selected.title,
          startDate: selected.startDate.toISOString(),
          isActive: selected.isActive,
          isFree: selected.isFree,
          maxParticipants: selected.maxParticipants,
          hasShirt: getShirtConfig(selected) !== null,
        },
        stats: {
          total,
          confirmed,
          pending,
          cancelled,
          spotsLeft: Math.max(selected.maxParticipants - occupied, 0),
          checkedIn,
        },
        shirtsBySize,
        recentRegistrations: recent.map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          paymentMethod: r.paymentMethod,
          createdAt: r.createdAt.toISOString(),
        })),
        // Ausente (não apenas oculto) para CHECKIN/SUPPORT
        ...(financial ? { financial } : {}),
      },
    });
  } catch (error) {
    console.error("Erro ao buscar dados do dashboard:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
