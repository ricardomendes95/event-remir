import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface EventGroup {
  eventId: string;
  eventTitle: string;
  eventPrice: number;
  eventDate: string;
  registrations: Array<{
    id: string;
    status: string;
    paymentMethod: string;
    event: {
      price: number;
    };
  }>;
}

interface DailyGroup {
  date: string;
  revenue: number;
  registrations: number;
  mercadoPagoRevenue: number;
  manualRevenue: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const eventId = searchParams.get("eventId");
    const format = searchParams.get("format");

    // Construir filtros de data
    const dateFilter: Prisma.RegistrationWhereInput = {};
    if (startDate && endDate) {
      const endDateWithTime = new Date(endDate);
      endDateWithTime.setHours(23, 59, 59, 999);

      dateFilter.createdAt = {
        gte: new Date(startDate),
        lte: endDateWithTime,
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

    // Simular paymentMethod por enquanto (baseado em paymentId)
    const registrationsWithPaymentMethod = registrations.map((reg) => ({
      ...reg,
      paymentMethod: reg.paymentId?.startsWith("mock_")
        ? "MERCADO_PAGO" // Mock é do Mercado Pago
        : reg.paymentId?.startsWith("manual_")
        ? "MANUAL" // Manual é inscrição manual
        : "MERCADO_PAGO", // Default para Mercado Pago
    }));

    // Calcular estatísticas gerais
    const totalRegistrations = registrationsWithPaymentMethod.length;
    const confirmedRegistrations = registrationsWithPaymentMethod.filter(
      (r) => r.status === "CONFIRMED"
    ).length;
    const pendingRegistrations = registrationsWithPaymentMethod.filter(
      (r) => r.status === "PENDING"
    ).length;
    const cancelledRegistrations = registrationsWithPaymentMethod.filter(
      (r) => r.status === "CANCELLED"
    ).length;

    // Estatísticas por método de pagamento
    const mercadoPagoRegistrations = registrationsWithPaymentMethod.filter(
      (r) => r.paymentMethod === "MERCADO_PAGO"
    );
    const manualRegistrations = registrationsWithPaymentMethod.filter(
      (r) => r.paymentMethod === "MANUAL"
    );

    const totalRevenue = registrationsWithPaymentMethod.reduce(
      (sum, r) => sum + Number(r.event.price),
      0
    );
    const confirmedRevenue = registrationsWithPaymentMethod
      .filter((r) => r.status === "CONFIRMED")
      .reduce((sum, r) => sum + Number(r.event.price), 0);
    const pendingRevenue = registrationsWithPaymentMethod
      .filter((r) => r.status === "PENDING")
      .reduce((sum, r) => sum + Number(r.event.price), 0);

    // Receitas por método de pagamento
    const mercadoPagoTotalRevenue = mercadoPagoRegistrations.reduce(
      (sum, r) => sum + Number(r.event.price),
      0
    );
    const mercadoPagoConfirmedRevenue = mercadoPagoRegistrations
      .filter((r) => r.status === "CONFIRMED")
      .reduce((sum, r) => sum + Number(r.event.price), 0);

    const manualTotalRevenue = manualRegistrations.reduce(
      (sum, r) => sum + Number(r.event.price),
      0
    );
    const manualConfirmedRevenue = manualRegistrations
      .filter((r) => r.status === "CONFIRMED")
      .reduce((sum, r) => sum + Number(r.event.price), 0);

    // Agrupar por evento
    const eventGroups = registrationsWithPaymentMethod.reduce(
      (groups, registration) => {
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
        groups[eventId].registrations.push({
          id: registration.id,
          status: registration.status,
          paymentMethod: registration.paymentMethod,
          event: {
            price: Number(registration.event.price),
          },
        });
        return groups;
      },
      {} as Record<string, EventGroup>
    );

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

        // Por método de pagamento
        const mercadoPagoRegs = group.registrations.filter(
          (r) => r.paymentMethod === "MERCADO_PAGO"
        ).length;
        const manualRegs = group.registrations.filter(
          (r) => r.paymentMethod === "MANUAL"
        ).length;

        const mercadoPagoConfirmed = group.registrations.filter(
          (r) => r.paymentMethod === "MERCADO_PAGO" && r.status === "CONFIRMED"
        ).length;
        const manualConfirmed = group.registrations.filter(
          (r) => r.paymentMethod === "MANUAL" && r.status === "CONFIRMED"
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
          // Por método de pagamento
          mercadoPagoRegistrations: mercadoPagoRegs,
          manualRegistrations: manualRegs,
          mercadoPagoConfirmedRegistrations: mercadoPagoConfirmed,
          manualConfirmedRegistrations: manualConfirmed,
          mercadoPagoRevenue: mercadoPagoRegs * group.eventPrice,
          manualRevenue: manualRegs * group.eventPrice,
          mercadoPagoConfirmedRevenue: mercadoPagoConfirmed * group.eventPrice,
          manualConfirmedRevenue: manualConfirmed * group.eventPrice,
        };
      }
    );

    // Agrupar por dia (para gráfico de receita diária)
    const dailyGroups = registrationsWithPaymentMethod.reduce(
      (groups, registration) => {
        const dateKey = registration.createdAt.toISOString().split("T")[0];
        if (!groups[dateKey]) {
          groups[dateKey] = {
            date: dateKey,
            revenue: 0,
            registrations: 0,
            mercadoPagoRevenue: 0,
            manualRevenue: 0,
          };
        }
        const price = Number(registration.event.price);
        groups[dateKey].revenue += price;
        groups[dateKey].registrations += 1;

        if (registration.paymentMethod === "MERCADO_PAGO") {
          groups[dateKey].mercadoPagoRevenue += price;
        } else {
          groups[dateKey].manualRevenue += price;
        }

        return groups;
      },
      {} as Record<string, DailyGroup>
    );

    const dailyRevenue = Object.values(dailyGroups).sort(
      (a: DailyGroup, b: DailyGroup) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const responseData = {
      totalRevenue,
      confirmedRevenue,
      pendingRevenue,
      totalRegistrations,
      confirmedRegistrations,
      pendingRegistrations,
      cancelledRegistrations,
      // Por método de pagamento
      mercadoPagoTotalRevenue,
      mercadoPagoConfirmedRevenue,
      mercadoPagoRegistrations: mercadoPagoRegistrations.length,
      manualTotalRevenue,
      manualConfirmedRevenue,
      manualRegistrations: manualRegistrations.length,
      eventBreakdown,
      dailyRevenue,
    };

    // Se format=export, retornar dados formatados para exportação
    if (format === "export") {
      const exportData = {
        summary: responseData,
        detailedRegistrations: registrationsWithPaymentMethod.map((reg) => ({
          id: reg.id,
          eventTitle: reg.event.title,
          participantName: reg.name,
          participantEmail: reg.email,
          participantCPF: reg.cpf,
          participantPhone: reg.phone,
          status: reg.status,
          paymentMethod: reg.paymentMethod,
          eventPrice: reg.event.price,
          registrationDate: reg.createdAt.toISOString(),
          eventDate: reg.event.startDate.toISOString(),
        })),
      };

      return NextResponse.json({
        success: true,
        data: exportData,
      });
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Erro ao buscar dados financeiros:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
