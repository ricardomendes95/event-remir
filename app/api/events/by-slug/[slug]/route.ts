import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { buildPublicBatchView } from "@/backend/services/eventBatchService";
import { OCCUPYING_STATUSES } from "@/backend/utils/eventBatches";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    const event = await withPrismaRetry(() =>
      prisma.event.findUnique({
        where: { slug },
        include: {
          registrations: {
            where: { status: { in: [...OCCUPYING_STATUSES] } },
            select: { id: true, batchId: true },
          },
          batches: true,
        },
      }),
    );

    if (!event) {
      return NextResponse.json(
        { error: "Evento não encontrado" },
        { status: 404 },
      );
    }

    const pricing = buildPublicBatchView(
      event,
      event.batches,
      event.registrations,
    );

    const eventResponse = {
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
      allowBatchRegistration: event.allowBatchRegistration,
      dynamicFormFields: event.dynamicFormFields,
      fixedFieldsConfig: event.fixedFieldsConfig,
      shirtConfig: pricing.shirtConfig,
      registrationEndDate: event.registrationEndDate.toISOString(),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };

    return NextResponse.json(eventResponse);
  } catch (error) {
    console.error("Erro ao buscar evento por slug:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
