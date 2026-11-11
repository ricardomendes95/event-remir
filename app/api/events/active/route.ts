import { NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { buildPublicBatchView } from "@/backend/services/eventBatchService";
import { OCCUPYING_STATUSES } from "@/backend/utils/eventBatches";

export async function GET() {
  try {
    const activeEvent = await withPrismaRetry(() =>
      prisma.event.findFirst({
        where: {
          isActive: true,
        },
        include: {
          registrations: {
            where: { status: { in: [...OCCUPYING_STATUSES] } },
            select: { id: true, batchId: true },
          },
          batches: true,
        },
      }),
    );

    if (!activeEvent) {
      return NextResponse.json(null);
    }

    const pricing = buildPublicBatchView(
      activeEvent,
      activeEvent.batches,
      activeEvent.registrations,
    );

    // Formato da resposta
    const eventResponse = {
      id: activeEvent.id,
      name: activeEvent.title, // title -> name
      description: activeEvent.description,
      eventDate: activeEvent.startDate.toISOString(), // startDate -> eventDate
      location: activeEvent.location,
      capacity: activeEvent.maxParticipants, // maxParticipants -> capacity
      currentRegistrations: Array.isArray(activeEvent.registrations)
        ? activeEvent.registrations.length
        : 0,
      price: pricing.price,
      activeBatch: pricing.activeBatch,
      batchesClosed: pricing.batchesClosed,
      bannerUrl: activeEvent.bannerUrl,
      isActive: activeEvent.isActive,
      isFree: activeEvent.isFree,
      formMode: activeEvent.formMode,
      allowBatchRegistration: activeEvent.allowBatchRegistration,
      dynamicFormFields: activeEvent.dynamicFormFields,
      fixedFieldsConfig: activeEvent.fixedFieldsConfig,
      registrationEndDate: activeEvent.registrationEndDate.toISOString(),
      createdAt: activeEvent.createdAt.toISOString(),
      updatedAt: activeEvent.updatedAt.toISOString(),
    };

    return NextResponse.json(eventResponse);
  } catch (error) {
    console.error("Erro ao buscar evento ativo:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
