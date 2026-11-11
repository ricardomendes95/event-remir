import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { z } from "zod";
import { validateDynamicFormData } from "@/backend/utils/dynamicFormValidator";
import type {
  DynamicField,
  DynamicFormFields,
} from "@/backend/schemas/dynamicFormSchemas";
import { validateShirtSelection } from "@/backend/utils/shirtPricing";
import {
  countOccupiedSlots,
  getEventBatchState,
} from "@/backend/services/eventBatchService";
import { OCCUPYING_STATUSES } from "@/backend/utils/eventBatches";

// Schema de validação para inscrição manual
const manualRegistrationSchema = z.object({
  eventId: z.string().min(1, "ID do evento é obrigatório"),
  participantData: z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    email: z.string().email("Email inválido"),
    cpf: z.string().min(11, "CPF deve ter 11 dígitos"),
    phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  }),
  dynamicFormData: z.record(z.string(), z.unknown()).optional(),
  wantsShirt: z.boolean().optional(),
  // Aceita null (participante sem camisa), não só undefined.
  shirtSize: z.string().nullable().optional(),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]).default("CONFIRMED"),
});

export async function POST(request: NextRequest) {
  try {
    // Validar dados da requisição
    const body = await request.json();
    const {
      eventId,
      participantData,
      dynamicFormData,
      wantsShirt,
      shirtSize,
      status,
    } = manualRegistrationSchema.parse(body);

    // Buscar evento
    const event = await withPrismaRetry(() =>
      prisma.event.findUnique({ where: { id: eventId } })
    );

    if (!event) {
      return NextResponse.json(
        { error: "Evento não encontrado" },
        { status: 404 }
      );
    }

    if (!event.isActive) {
      return NextResponse.json(
        { error: "Evento não está ativo" },
        { status: 400 }
      );
    }

    // Verificar se ainda há vagas (só PENDING/CONFIRMED ocupam vaga)
    const occupiesSlot = (OCCUPYING_STATUSES as readonly string[]).includes(
      status
    );
    if (occupiesSlot) {
      const occupied = await withPrismaRetry(() =>
        countOccupiedSlots(prisma, eventId)
      );
      if (occupied >= event.maxParticipants) {
        return NextResponse.json({ error: "Evento lotado" }, { status: 400 });
      }
    }

    const requiresDynamic = event.formMode !== "FIXED_ONLY";

    if (requiresDynamic && !dynamicFormData) {
      return NextResponse.json(
        { error: "Respostas do formulário dinâmico são obrigatórias" },
        { status: 400 }
      );
    }

    // Dedup por CPF
    const cpfDigits = participantData.cpf.replace(/\D/g, "");
    const cleanPhone = participantData.phone.replace(/\D/g, "");
    const existingRegistration = await prisma.registration.findFirst({
      where: { eventId, cpf: cpfDigits },
    });
    if (existingRegistration) {
      return NextResponse.json(
        { error: "CPF já possui inscrição neste evento" },
        { status: 400 }
      );
    }

    // Validar dados dinâmicos contra o schema do evento
    let sanitizedDynamic: Record<string, unknown> | null = null;
    if (requiresDynamic) {
      const fields =
        (event.dynamicFormFields as DynamicFormFields | null) ?? [];
      const result = validateDynamicFormData(
        fields as DynamicField[],
        dynamicFormData ?? {}
      );
      if (!result.valid) {
        return NextResponse.json(
          {
            error: "Dados do formulário inválidos",
            details: result.errors,
          },
          { status: 422 }
        );
      }
      sanitizedDynamic = result.sanitized;
    }

    // Validar seleção de camisa (quando o evento oferece)
    const shirtSelection = validateShirtSelection(event, {
      wantsShirt,
      shirtSize,
    });
    if (!shirtSelection.ok) {
      return NextResponse.json(
        { error: shirtSelection.error || "Seleção de camisa inválida" },
        { status: 422 }
      );
    }

    // A inscrição manual entra no lote vigente (sem lote vigente, fica sem
    // lote); o admin não é bloqueado pelo fim dos lotes.
    const batchState = await withPrismaRetry(() =>
      getEventBatchState(prisma, eventId)
    );

    // Criar inscrição manual
    const registration = await prisma.registration.create({
      data: {
        eventId,
        name: participantData.name,
        email: participantData.email,
        cpf: cpfDigits,
        phone: cleanPhone,
        status,
        paymentMethod: "MANUAL",
        paymentId: `manual_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        wantsShirt: shirtSelection.wantsShirt,
        shirtSize: shirtSelection.shirtSize,
        batchId: batchState.activeBatch?.id ?? null,
        dynamicFormData: sanitizedDynamic
          ? (sanitizedDynamic as Prisma.InputJsonValue)
          : undefined,
      },
    });

    console.log("✅ Inscrição manual criada com sucesso:", registration.id);

    return NextResponse.json({
      success: true,
      registration: {
        id: registration.id,
        name: registration.name,
        email: registration.email,
        status: registration.status,
        eventTitle: event.title,
      },
    });
  } catch (error) {
    console.error("Erro ao criar inscrição manual:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
