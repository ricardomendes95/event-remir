import { NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { buildPublicBatchView } from "@/backend/services/eventBatchService";
import { OCCUPYING_STATUSES } from "@/backend/utils/eventBatches";

export async function GET() {
  try {
    const activeEvents = await withPrismaRetry(() =>
      prisma.event.findMany({
        where: { isActive: true },
        include: {
          registrations: {
            where: { status: { in: [...OCCUPYING_STATUSES] } },
            select: { id: true, batchId: true },
          },
          batches: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    );

    const events = activeEvents.map((event) => {
      const pricing = buildPublicBatchView(
        event,
        event.batches,
        event.registrations,
      );
      return {
        id: event.id,
        name: event.title,
        description: event.description,
        slug: event.slug,
        eventDate: event.startDate.toISOString(),
        location: event.location,
        capacity: event.maxParticipants,
        currentRegistrations: event.registrations.length,
        price: pricing.price,
        activeBatch: pricing.activeBatch,
        batchesClosed: pricing.batchesClosed,
        bannerUrl: event.bannerUrl,
        isActive: event.isActive,
        isFree: event.isFree,
        formMode: event.formMode,
        dynamicFormFields: event.dynamicFormFields,
        registrationEndDate: event.registrationEndDate.toISOString(),
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
      };
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("Erro ao listar eventos ativos:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
