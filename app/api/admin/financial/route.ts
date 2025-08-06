import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface EventGroup {
  eventId: string;
  eventTitle: string;
  eventPrice: number;
  eventDate: string;
  registrations: Array<{
    status: string;
    event: {
      price: number;
    };
  }>;
}

interface DailyGroup {
  date: string;
  revenue: number;
  registrations: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const eventId = searchParams.get("eventId");

    // Construir filtros de data
    const dateFilter: Prisma.RegistrationWhereInput = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // Construir filtros de evento
    const eventFilter: Prisma.RegistrationWhereInput = {};
    if (eventId && eventId !== "ALL") {
      eventFilter.eventId = eventId;
    }

    // Combinar filtros
    const whereClause = {
      ...dateFilter,
      ...eventFilter,
    };

    // Buscar todas as inscrições com dados dos eventos
    const registrations = await prisma.registration.findMany({
      where: whereClause,
      include: {
        event: {
          select: {
            id: true,
            title: true,
            price: true,
            startDate: true,
          },
        },
      },
    });

    // Calcular estatísticas gerais
    const totalRegistrations = registrations.length;
    const confirmedRegistrations = registrations.filter(
      (r) => r.status === "CONFIRMED"
    ).length;
    const pendingRegistrations = registrations.filter(
      (r) => r.status === "PENDING"
    ).length;
    const cancelledRegistrations = registrations.filter(
      (r) => r.status === "CANCELLED"
    ).length;

    const totalRevenue = registrations.reduce(
      (sum, r) => sum + Number(r.event.price),
      0
    );
    const confirmedRevenue = registrations
      .filter((r) => r.status === "CONFIRMED")
      .reduce((sum, r) => sum + Number(r.event.price), 0);
    const pendingRevenue = registrations
      .filter((r) => r.status === "PENDING")
      .reduce((sum, r) => sum + Number(r.event.price), 0);

    // Agrupar por evento
    const eventGroups = registrations.reduce((groups, registration) => {
      const eventId = registration.event.id;
      if (!groups[eventId]) {
        groups[eventId] = {
          eventId,
          eventTitle: registration.event.title,
          eventPrice: Number(registration.event.price),
          eventDate: registration.event.startDate.toISOString(),
          registrations: [],
        };
      }
      groups[eventId].registrations.push(registration);
      return groups;
    }, {} as Record<string, EventGroup>);

    // Calcular estatísticas por evento
    const eventBreakdown = Object.values(eventGroups).map(
      (group: EventGroup) => {
        const totalRegs = group.registrations.length;
        const confirmedRegs = group.registrations.filter(
          (r) => r.status === "CONFIRMED"
        ).length;
        const pendingRegs = group.registrations.filter(
          (r) => r.status === "PENDING"
        ).length;
        const cancelledRegs = group.registrations.filter(
          (r) => r.status === "CANCELLED"
        ).length;

        return {
          eventId: group.eventId,
          eventTitle: group.eventTitle,
          eventPrice: group.eventPrice,
          eventDate: group.eventDate,
          totalRegistrations: totalRegs,
          confirmedRegistrations: confirmedRegs,
          pendingRegistrations: pendingRegs,
          cancelledRegistrations: cancelledRegs,
          totalRevenue: totalRegs * group.eventPrice,
          confirmedRevenue: confirmedRegs * group.eventPrice,
          pendingRevenue: pendingRegs * group.eventPrice,
        };
      }
    );

    // Agrupar por dia (para gráfico de receita diária - simplificado)
    const dailyGroups = registrations.reduce((groups, registration) => {
      const dateKey = registration.createdAt.toISOString().split("T")[0];
      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateKey,
          revenue: 0,
          registrations: 0,
        };
      }
      groups[dateKey].revenue += Number(registration.event.price);
      groups[dateKey].registrations += 1;
      return groups;
    }, {} as Record<string, DailyGroup>);

    const dailyRevenue = Object.values(dailyGroups).sort(
      (a: DailyGroup, b: DailyGroup) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return NextResponse.json({
      success: true,
      data: {
        totalRevenue,
        confirmedRevenue,
        pendingRevenue,
        totalRegistrations,
        confirmedRegistrations,
        pendingRegistrations,
        cancelledRegistrations,
        eventBreakdown,
        dailyRevenue,
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
