import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { CreateFreeBatchSchema } from "@/backend/schemas/batchRegistrationSchemas";
import { createFreeBatch } from "@/backend/services/batchRegistrationService";
import {
  batchZodErrorResponse,
  serviceFailureResponse,
} from "@/backend/utils/validationResponse";

/**
 * Inscrição em lote gratuita: N inscrições CONFIRMED atômicas, sem Order.
 * Rota pública (fluxo do participante).
 */
export async function POST(request: NextRequest) {
  try {
    const { eventId, participants } = CreateFreeBatchSchema.parse(
      await request.json()
    );

    const event = await withPrismaRetry(() =>
      prisma.event.findUnique({ where: { id: eventId } })
    );
    if (!event) {
      return NextResponse.json(
        { success: false, error: "Evento não encontrado" },
        { status: 404 }
      );
    }

    const created = await createFreeBatch(event, participants);
    if (!created.ok) return serviceFailureResponse(created);

    return NextResponse.json(
      {
        success: true,
        data: {
          eventTitle: event.title,
          registrations: created.registrations,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) return batchZodErrorResponse(error);
    console.error("Erro em /api/registrations/create-free-batch:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
