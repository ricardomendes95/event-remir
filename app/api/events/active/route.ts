import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const activeEvent = await prisma.event.findFirst({
      where: {
        isActive: true,
      },
      include: {
        _count: {
          select: {
            registrations: true,
          },
        },
      },
    });

    if (!activeEvent) {
      return NextResponse.json(null);
    }

    // Formato da resposta
    const eventResponse = {
      id: activeEvent.id,
      name: activeEvent.title, // title -> name
      description: activeEvent.description,
      eventDate: activeEvent.startDate.toISOString(), // startDate -> eventDate
      location: activeEvent.location,
      capacity: activeEvent.maxParticipants, // maxParticipants -> capacity
      currentRegistrations: activeEvent._count.registrations,
      price: Number(activeEvent.price),
      bannerUrl: activeEvent.bannerUrl,
      isActive: activeEvent.isActive,
      registrationEndDate: activeEvent.registrationEndDate.toISOString(),
      createdAt: activeEvent.createdAt.toISOString(),
      updatedAt: activeEvent.updatedAt.toISOString(),
    };

    return NextResponse.json(eventResponse);
  } catch (error) {
    console.error("Erro ao buscar evento ativo:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
