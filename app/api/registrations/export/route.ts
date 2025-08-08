import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: "ID do evento é obrigatório" },
        { status: 400 }
      );
    }

    // Buscar informações do evento
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        startDate: true,
        endDate: true,
        location: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { success: false, error: "Evento não encontrado" },
        { status: 404 }
      );
    }

    // Buscar todas as inscrições confirmadas do evento
    const registrations = await prisma.registration.findMany({
      where: {
        eventId: eventId,
        status: "CONFIRMED",
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            price: true,
            startDate: true,
            endDate: true,
            location: true,
          },
        },
      },
      orderBy: {
        name: "asc", // Ordenar por nome para facilitar localização
      },
    });

    // Calcular estatísticas
    const stats = {
      total: registrations.length,
      checkedIn: registrations.filter((reg) => reg.checkedInAt).length,
      pending: registrations.filter((reg) => !reg.checkedInAt).length,
      totalRevenue: registrations.length * (event.price || 0),
    };

    // Adicionar estatísticas de check-in por horário (opcional)
    const checkinsByHour = registrations
      .filter((reg) => reg.checkedInAt)
      .reduce((acc, reg) => {
        const hour = new Date(reg.checkedInAt!).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

    return NextResponse.json({
      success: true,
      data: {
        event,
        registrations,
        stats: {
          ...stats,
          checkinRate:
            stats.total > 0
              ? Math.round((stats.checkedIn / stats.total) * 100)
              : 0,
        },
        checkinsByHour,
        exportedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Erro ao exportar inscrições:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
