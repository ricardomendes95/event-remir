import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { validateDynamicFormData } from "@/backend/utils/dynamicFormValidator";
import type {
  DynamicField,
  DynamicFormFields,
} from "@/backend/schemas/dynamicFormSchemas";
import { createInfinitePayCheckoutForRegistration } from "@/backend/services/payment/infinitePayService";
import {
  resolveBaseValue,
  validateShirtSelection,
} from "@/backend/utils/shirtPricing";

// Schema de validação
const createPreferenceSchema = z.object({
  eventId: z.string().min(1, "ID do evento é obrigatório"),
  participantData: z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    email: z.string().email("Email inválido"),
    cpf: z.string().min(11, "CPF deve ter 11 dígitos"),
    phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  }),
  registrationId: z.string().optional(), // ID da inscrição existente para atualizar
  dynamicFormData: z.record(z.string(), z.unknown()).optional(),
  wantsShirt: z.boolean().optional(),
  // A camisa é opcional: o participante escolhe se quer ou não. Quando não
  // quer, o frontend envia `shirtSize: null`, então precisamos aceitar null
  // além de undefined (senão o Zod rejeita com "invalid_type").
  shirtSize: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Validar dados da requisição
    const body = await request.json();
    const {
      eventId,
      participantData,
      registrationId,
      dynamicFormData,
      wantsShirt,
      shirtSize,
    } = createPreferenceSchema.parse(body);

    // Buscar evento
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        _count: {
          select: {
            registrations: true,
          },
        },
      },
    });

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

    // Eventos gratuitos devem usar /api/registrations/create-free
    if (event.isFree) {
      return NextResponse.json(
        {
          error:
            "Este evento é gratuito. Use /api/registrations/create-free para criar a inscrição.",
        },
        { status: 400 }
      );
    }

    // DYNAMIC_ONLY não é permitido em evento pago (defesa em profundidade)
    if (event.formMode === "DYNAMIC_ONLY") {
      return NextResponse.json(
        {
          error:
            "Configuração inválida: DYNAMIC_ONLY só é permitido em eventos gratuitos",
        },
        { status: 400 }
      );
    }

    // Validar payload do formulário dinâmico quando o evento exige (BOTH)
    let sanitizedDynamic: Record<string, unknown> | null = null;
    if (event.formMode === "BOTH") {
      const fields =
        (event.dynamicFormFields as DynamicFormFields | null) ?? [];
      const result = validateDynamicFormData(
        fields as DynamicField[],
        dynamicFormData ?? {}
      );
      if (!result.valid) {
        return NextResponse.json(
          {
            error: "Dados do formulário dinâmico inválidos",
            errors: result.errors,
          },
          { status: 422 }
        );
      }
      sanitizedDynamic = result.sanitized;
    }

    // Verificar se ainda há vagas
    if (event._count.registrations >= event.maxParticipants) {
      return NextResponse.json({ error: "Evento lotado" }, { status: 400 });
    }

    // Verificar se inscrições estão abertas
    const now = new Date();
    if (now < event.registrationStartDate || now > event.registrationEndDate) {
      return NextResponse.json(
        { error: "Período de inscrições encerrado" },
        { status: 400 }
      );
    }

    // Validar seleção de camisa e recalcular o valor base no servidor
    // (nunca confiar no valor enviado pelo cliente)
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
    const baseValue = resolveBaseValue(event, shirtSelection.wantsShirt);

    // Verificar se participante já está inscrito.
    // O CPF é gravado sem formatação, então a busca também precisa normalizar
    // (senão um CPF formatado nunca casa e cria inscrição duplicada).
    const cpfDigits = participantData.cpf.replace(/\D/g, "");
    const existingRegistration = await prisma.registration.findFirst({
      where: {
        eventId,
        cpf: cpfDigits,
      },
    });

    let registrationAction: "CREATE" | "UPDATE" = "CREATE";
    let targetRegistrationId: string | null = null;

    if (existingRegistration) {
      // Verificar se status permite nova tentativa de pagamento
      if (
        !["PENDING", "CANCELLED", "PAYMENT_FAILED"].includes(
          existingRegistration.status
        )
      ) {
        return NextResponse.json(
          { error: "CPF já possui inscrição confirmada neste evento" },
          { status: 400 }
        );
      }

      // Se registrationId foi fornecido, validar se corresponde à inscrição existente
      if (registrationId && registrationId !== existingRegistration.id) {
        return NextResponse.json(
          { error: "ID de inscrição não corresponde ao CPF informado" },
          { status: 400 }
        );
      }

      // PENDING/CANCELLED/PAYMENT_FAILED: reaproveitar a inscrição existente
      // (UPDATE) e gerar um novo checkout — nunca criar duplicata.
      registrationAction = "UPDATE";
      targetRegistrationId = existingRegistration.id;
    }

    // Persistir a inscrição primeiro para obter o id (usado como order_nsu).
    let regId: string;
    if (registrationAction === "UPDATE" && targetRegistrationId) {
      await prisma.registration.update({
        where: { id: targetRegistrationId },
        data: {
          name: participantData.name,
          email: participantData.email,
          phone: participantData.phone.replace(/\D/g, ""),
          status: "PENDING",
          paymentMethod: "INFINITE_PAY",
          paymentError: null,
          wantsShirt: shirtSelection.wantsShirt,
          shirtSize: shirtSelection.shirtSize,
          ...(sanitizedDynamic
            ? { dynamicFormData: sanitizedDynamic as Prisma.InputJsonValue }
            : {}),
        },
      });
      regId = targetRegistrationId;
    } else {
      const created = await prisma.registration.create({
        data: {
          eventId,
          name: participantData.name,
          email: participantData.email,
          cpf: participantData.cpf.replace(/\D/g, ""),
          phone: participantData.phone.replace(/\D/g, ""),
          status: "PENDING",
          paymentMethod: "INFINITE_PAY",
          wantsShirt: shirtSelection.wantsShirt,
          shirtSize: shirtSelection.shirtSize,
          dynamicFormData: sanitizedDynamic
            ? (sanitizedDynamic as Prisma.InputJsonValue)
            : undefined,
        },
      });
      regId = created.id;
    }

    try {
      const checkout = await createInfinitePayCheckoutForRegistration({
        registrationId: regId,
        eventTitle: event.title,
        baseValue,
        participant: {
          name: participantData.name,
          email: participantData.email,
          phone: participantData.phone,
        },
      });

      await prisma.registration.update({
        where: { id: regId },
        data: { paymentId: checkout.providerRef },
      });

      return NextResponse.json({
        success: true,
        gateway: "INFINITE_PAY",
        checkoutUrl: checkout.checkoutUrl,
        registrationId: regId,
        // No InfinitePay o método e as parcelas são escolhidos no checkout.
        paymentInfo: {
          finalValue: baseValue,
        },
      });
    } catch (err) {
      console.error("Erro ao criar checkout InfinitePay:", err);
      return NextResponse.json(
        {
          error:
            "Não foi possível iniciar o pagamento agora. Tente novamente em instantes.",
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Erro ao criar preferência:", error);

    if (error instanceof z.ZodError) {
      // Monta uma mensagem legível a partir dos campos inválidos, para que o
      // frontend exiba algo mais claro do que um genérico "Dados inválidos".
      const detalhes = error.issues
        .map((issue) => {
          const campo = issue.path.join(".") || "campo";
          return `${campo}: ${issue.message}`;
        })
        .join("; ");
      return NextResponse.json(
        {
          error: detalhes
            ? `Dados inválidos — ${detalhes}`
            : "Dados inválidos",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
