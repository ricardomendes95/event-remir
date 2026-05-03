import { NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";

export async function GET() {
  try {
    const activeEvents = await withPrismaRetry(() =>
      prisma.event.findMany({
        where: { isActive: true },
        include: {
          registrations: {
            where: { status: "CONFIRMED" },
            select: { id: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    );

    const events = activeEvents.map((event) => ({
      id: event.id,
      name: event.title,
      description: event.description,
      slug: event.slug,
      eventDate: event.startDate.toISOString(),
      location: event.location,
      capacity: event.maxParticipants,
      currentRegistrations: event.registrations.length,
      price: Number(event.price),
      bannerUrl: event.bannerUrl,
      isActive: event.isActive,
      isFree: event.isFree,
      formMode: event.formMode,
      dynamicFormFields: event.dynamicFormFields,
      registrationEndDate: event.registrationEndDate.toISOString(),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    }));

    return NextResponse.json(events);
  } catch (error) {
    console.error("Erro ao listar eventos ativos:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
