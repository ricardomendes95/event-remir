import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { isValidCpf } from "@/utils/cpfValidator";
import { validateDynamicFormData } from "@/backend/utils/dynamicFormValidator";
import type {
  DynamicField,
  DynamicFormFields,
} from "@/backend/schemas/dynamicFormSchemas";

const fixedDataSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome muito longo"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  cpf: z.string().min(11, "CPF deve ter 11 dígitos"),
  phone: z.string().optional().or(z.literal("")),
});

const createFreeSchema = z.object({
  eventId: z.string().min(1, "ID do evento é obrigatório"),
  fixedData: fixedDataSchema,
  dynamicFormData: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, fixedData, dynamicFormData } =
      createFreeSchema.parse(body);

    // Buscar evento com contagem de inscrições
    const event = await withPrismaRetry(() =>
      prisma.event.findUnique({
        where: { id: eventId },
        include: { _count: { select: { registrations: true } } },
      })
    );

    if (!event) {
      return NextResponse.json(
        { success: false, error: "Evento não encontrado" },
        { status: 404 }
      );
    }

    if (!event.isActive) {
      return NextResponse.json(
        { success: false, error: "Evento não está ativo" },
        { status: 400 }
      );
    }

    if (!event.isFree) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Este evento não é gratuito. Use o fluxo de pagamento normal.",
        },
        { status: 400 }
      );
    }

    // Janela de inscrição
    const now = new Date();
    if (
      now < event.registrationStartDate ||
      now > event.registrationEndDate
    ) {
      return NextResponse.json(
        { success: false, error: "Inscrições não estão abertas" },
        { status: 400 }
      );
    }

    // Vagas
    if (event._count.registrations >= event.maxParticipants) {
      return NextResponse.json(
        { success: false, error: "Evento lotado" },
        { status: 400 }
      );
    }

    const requiresDynamic = event.formMode !== "FIXED_ONLY";

    // Validar campos fixos obrigatórios conforme configuração do evento
    const ffc = (event as Record<string, unknown>).fixedFieldsConfig as
      | { email?: { required: boolean }; phone?: { required: boolean } }
      | null;
    if (ffc?.email?.required && !fixedData.email) {
      return NextResponse.json(
        { success: false, error: "Email é obrigatório para este evento" },
        { status: 422 }
      );
    }
    if (ffc?.phone?.required && !fixedData.phone) {
      return NextResponse.json(
        { success: false, error: "Telefone é obrigatório para este evento" },
        { status: 422 }
      );
    }

    if (requiresDynamic && !dynamicFormData) {
      return NextResponse.json(
        {
          success: false,
          error: "Respostas do formulário dinâmico são obrigatórias",
        },
        { status: 400 }
      );
    }

    // Validar CPF
    const cpfCheck = isValidCpf(fixedData.cpf);
    if (!cpfCheck.isValid) {
      return NextResponse.json(
        { success: false, error: cpfCheck.error || "CPF inválido" },
        { status: 400 }
      );
    }
    const cpfDigits = fixedData.cpf.replace(/\D/g, "");
    const cleanPhone = fixedData.phone ? fixedData.phone.replace(/\D/g, "") : "";
    if (cleanPhone && (cleanPhone.length < 10 || cleanPhone.length > 11)) {
      return NextResponse.json(
        { success: false, error: "Telefone inválido" },
        { status: 400 }
      );
    }

    // Dedup por CPF + evento
    const existing = await withPrismaRetry(() =>
      prisma.registration.findFirst({
        where: { eventId, cpf: cpfDigits },
        select: { id: true, status: true },
      })
    );
    if (existing && existing.status === "CONFIRMED") {
      return NextResponse.json(
        {
          success: false,
          error: "CPF já possui inscrição confirmada neste evento",
        },
        { status: 409 }
      );
    }

    // Validar dados dinâmicos contra os campos do evento
    let sanitizedDynamic: Record<string, unknown> | null = null;
    if (requiresDynamic) {
      const fields = (event.dynamicFormFields as DynamicFormFields | null) ?? [];
      const result = validateDynamicFormData(
        fields as DynamicField[],
        dynamicFormData ?? {}
      );
      if (!result.valid) {
        return NextResponse.json(
          {
            success: false,
            error: "Dados do formulário inválidos",
            errors: result.errors,
          },
          { status: 422 }
        );
      }
      sanitizedDynamic = result.sanitized;
    }

    // Criar registration confirmada
    const paymentId = `free_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 11)}`;

    const registration = await withPrismaRetry(() =>
      prisma.registration.create({
        data: {
          eventId,
          name: fixedData.name,
          email: fixedData.email || null,
          cpf: cpfDigits,
          phone: cleanPhone || null,
          status: "CONFIRMED",
          paymentMethod: "FREE",
          paymentId,
          dynamicFormData: sanitizedDynamic
            ? (sanitizedDynamic as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      })
    );

    return NextResponse.json({
      success: true,
      registration: {
        id: registration.id,
        status: registration.status,
        eventTitle: event.title,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Dados inválidos",
          errors: error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 422 }
      );
    }
    console.error("Erro em /api/registrations/create-free:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
