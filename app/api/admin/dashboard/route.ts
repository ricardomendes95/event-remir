import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { resolveBaseValue } from "@/backend/utils/shirtPricing";
import { canViewFinancialValues } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const showFinancials = canViewFinancialValues(
      request.headers.get("x-user-role")
    );
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalRegistrations,
      activeEventsCount,
      last7DaysCount,
      confirmedRegistrationsRaw,
      upcomingEventsRaw,
      recentRegistrationsRaw,
    ] = await withPrismaRetry(() =>
      Promise.all([
        prisma.registration.count(),
        prisma.event.count({ where: { isActive: true } }),
        prisma.registration.count({
          where: { createdAt: { gte: sevenDaysAgo } },
        }),
        prisma.registration.findMany({
          where: { status: "CONFIRMED" },
          select: {
            wantsShirt: true,
            batch: { select: { price: true, priceWithShirt: true } },
            event: { select: { price: true, shirtConfig: true } },
          },
        }),
        prisma.event.findMany({
          where: { isActive: true, startDate: { gte: now } },
          select: {
            id: true,
            title: true,
            startDate: true,
            price: true,
            isFree: true,
            maxParticipants: true,
            _count: {
              select: {
                registrations: { where: { status: "CONFIRMED" } },
              },
            },
          },
          orderBy: { startDate: "asc" },
          take: 10,
        }),
        prisma.registration.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            status: true,
            paymentMethod: true,
            createdAt: true,
            event: { select: { title: true } },
          },
        }),
      ])
    );

    const confirmedRevenue = confirmedRegistrationsRaw.reduce(
      (sum, r) =>
        sum +
        resolveBaseValue(
          { price: Number(r.event.price), shirtConfig: r.event.shirtConfig },
          r.wantsShirt ?? false,
          r.batch
        ),
      0
    );

    const upcomingEvents = upcomingEventsRaw.map((e) => ({
      id: e.id,
      title: e.title,
      startDate: e.startDate.toISOString(),
      price: showFinancials ? Number(e.price) : null,
      isFree: e.isFree,
      maxParticipants: e.maxParticipants,
      confirmedCount: e._count.registrations,
      occupancyPercent:
        e.maxParticipants > 0
          ? Math.round((e._count.registrations / e.maxParticipants) * 100)
          : 0,
    }));

    const recentRegistrations = recentRegistrationsRaw.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      paymentMethod: r.paymentMethod,
      createdAt: r.createdAt.toISOString(),
      eventTitle: r.event.title,
    }));

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          totalRegistrations,
          // CHECKIN/SUPPORT não veem receita (ADR-002)
          confirmedRevenue: showFinancials
            ? Math.round(confirmedRevenue * 100) / 100
            : null,
          activeEvents: activeEventsCount,
          last7DaysRegistrations: last7DaysCount,
        },
        upcomingEvents,
        recentRegistrations,
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
