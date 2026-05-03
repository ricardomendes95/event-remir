import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { Preference } from "mercadopago";
import {
  mercadoPagoClient,
  validateMercadoPagoConfig,
} from "@/lib/mercadopago";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PaymentFeeCalculator } from "@/backend/utils/paymentFeeCalculator";
import { PaymentConfig } from "@/backend/schemas/eventSchemas";
import { validateDynamicFormData } from "@/backend/utils/dynamicFormValidator";
import type {
  DynamicField,
  DynamicFormFields,
} from "@/backend/schemas/dynamicFormSchemas";

// Helper function para mapear métodos de pagamento para exclusões do MercadoPago
function getExcludedPaymentTypes(selectedMethod: string) {
  switch (selectedMethod) {
    case "pix":
      return [{ id: "credit_card" }, { id: "debit_card" }, { id: "ticket" }];
    case "credit_card":
      return [{ id: "ticket" }]; // Não excluir account_money pois pode causar problemas
    case "debit_card":
      return [{ id: "ticket" }]; // Não excluir account_money pois pode causar problemas
    default:
      return [];
  }
}

// Helper function para excluir métodos específicos de cartão
function getExcludedPaymentMethods(selectedMethod: string) {
  switch (selectedMethod) {
    case "pix":
      // Exclui todas as bandeiras de cartão para forçar só PIX
      return [
        { id: "master" },
        { id: "visa" },
        { id: "amex" },
        { id: "elo" },
        { id: "hipercard" },
        { id: "cabal" },
      ];
    case "debit_card":
      // Para débito, não precisamos excluir bandeiras específicas
      // O excluded_payment_types já cuida da restrição
      return [];
    case "credit_card":
      // Para crédito, não precisamos excluir bandeiras específicas
      return [];
    default:
      return [];
  }
}

// Helper para extrair DDD e telefone de forma mais robusta
export function parsePhoneNumber(phone: string) {
  const cleanPhone = phone.replace(/\D/g, "");

  // Se tem 11 dígitos (9 + DDD), extrair normalmente
  if (cleanPhone.length === 11) {
    return {
      area_code: cleanPhone.substring(0, 2),
      number: cleanPhone.substring(2),
    };
  }

  // Se tem 10 dígitos (8 + DDD), extrair normalmente
  if (cleanPhone.length === 10) {
    return {
      area_code: cleanPhone.substring(0, 2),
      number: cleanPhone.substring(2),
    };
  }

  // Fallback: assumir que os 2 primeiros são DDD
  return {
    area_code: cleanPhone.substring(0, 2) || "11",
    number: cleanPhone.substring(2) || cleanPhone,
  };
}

// Schema de validação
const createPreferenceSchema = z.object({
  eventId: z.string().min(1, "ID do evento é obrigatório"),
  participantData: z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    email: z.string().email("Email inválido"),
    cpf: z.string().min(11, "CPF deve ter 11 dígitos"),
    phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  }),
  paymentData: z.object({
    method: z.enum(["pix", "credit_card", "debit_card"]),
    installments: z.number().min(1).max(12).optional(),
  }),
  registrationId: z.string().optional(), // ID da inscrição existente para atualizar
  dynamicFormData: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Validar configuração do Mercado Pago
    validateMercadoPagoConfig();

    // Validar dados da requisição
    const body = await request.json();
    const {
      eventId,
      participantData,
      paymentData,
      registrationId,
      dynamicFormData,
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

    // Validar método de pagamento disponível para este evento
    const eventWithPaymentConfig = event as typeof event & {
      paymentConfig?: PaymentConfig | null;
    };
    const eventPaymentConfig = eventWithPaymentConfig.paymentConfig;
    const isPaymentMethodValid = PaymentFeeCalculator.validatePaymentOption(
      paymentData.method,
      paymentData.installments,
      eventPaymentConfig || undefined
    );

    if (!isPaymentMethodValid) {
      return NextResponse.json(
        {
          error: "Método de pagamento não disponível para este evento",
          method: paymentData.method,
          installments: paymentData.installments,
        },
        { status: 400 }
      );
    }

    // Calcular valor final com taxas
    const paymentOptions = PaymentFeeCalculator.calculatePaymentOptions(
      event.price,
      eventPaymentConfig || undefined
    );

    const selectedOption = paymentOptions.available_methods.find(
      (option) =>
        option.method === paymentData.method &&
        (paymentData.method !== "credit_card" ||
          option.installments === paymentData.installments)
    );

    if (!selectedOption) {
      return NextResponse.json(
        { error: "Opção de pagamento não encontrada" },
        { status: 400 }
      );
    }

    // Validar valor mínimo para parcelamento
    if (
      paymentData.method === "credit_card" &&
      paymentData.installments &&
      paymentData.installments > 1
    ) {
      if (selectedOption.final_value < 5) {
        return NextResponse.json(
          {
            error: "Valor mínimo para parcelamento é R$ 5,00",
            current_value: selectedOption.final_value,
            minimum_value: 5,
          },
          { status: 400 }
        );
      }

      const valuePerInstallment =
        selectedOption.final_value / paymentData.installments;
      if (valuePerInstallment < 5) {
        return NextResponse.json(
          {
            error: `Valor mínimo por parcela é R$ 5,00. Com ${
              paymentData.installments
            }x ficaria R$ ${valuePerInstallment.toFixed(2)} por parcela`,
            current_value_per_installment: valuePerInstallment,
            minimum_value_per_installment: 5,
          },
          { status: 400 }
        );
      }
    }

    // Verificar se participante já está inscrito (apenas CPF é único)
    const existingRegistration = await prisma.registration.findFirst({
      where: {
        eventId,
        cpf: participantData.cpf,
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

      // Lógica refinada baseada em status + existência de paymentId
      const { status, paymentId } = existingRegistration;

      if (status === "CANCELLED" || status === "PAYMENT_FAILED") {
        // CANCELLED ou PAYMENT_FAILED: criar nova preferência no MP (não dá pra atualizar a existente)
        // Ação no banco: UPDATE do registro existente
        registrationAction = "UPDATE";
        targetRegistrationId = existingRegistration.id;
      } else if (status === "PENDING") {
        if (!paymentId) {
          // PENDING sem paymentId: criar nova preferência no MP (não existe preferência anterior)
          // Ação no banco: UPDATE do registro existente
          registrationAction = "UPDATE";
          targetRegistrationId = existingRegistration.id;
        } else {
          // PENDING com paymentId: criar nova preferência no MP (substituir a anterior)
          // Ação no banco: UPDATE do registro existente
          registrationAction = "UPDATE";
          targetRegistrationId = existingRegistration.id;
        }
      }
    }

    // Verificar se Mercado Pago está configurado
    if (!mercadoPagoClient) {
      return NextResponse.json(
        { error: "Sistema de pagamento não configurado" },
        { status: 500 }
      );
    }

    // Extrair telefone de forma mais robusta
    const phoneData = parsePhoneNumber(participantData.phone);

    // Criar preferência no Mercado Pago
    const preference = new Preference(mercadoPagoClient);

    const preferenceData = {
      items: [
        {
          id: eventId,
          title: selectedOption.passthrough_fee
            ? `${event.title} - ${selectedOption.description}`
            : event.title,
          description: selectedOption.passthrough_fee
            ? `${
                event.description
              } | Taxa de serviço: R$ ${selectedOption.fee_amount.toFixed(2)}`
            : event.description,
          quantity: 1,
          unit_price: selectedOption.final_value,
          currency_id: "BRL",
        },
      ],
      payer: {
        name: participantData.name,
        email: participantData.email,
        identification: {
          type: "CPF",
          number: participantData.cpf.replace(/\D/g, ""),
        },
        phone: phoneData,
      },
      back_urls: {
        success: `${process.env.NEXTAUTH_URL}/payment/success`,
        failure: `${process.env.NEXTAUTH_URL}/payment/failure`,
        pending: `${process.env.NEXTAUTH_URL}/payment/pending`,
      },
      notification_url: `${process.env.NEXTAUTH_URL}/api/payments/webhook`,
      // External reference mais único incluindo timestamp
      external_reference: `event_${eventId}_cpf_${participantData.cpf.replace(
        /\D/g,
        ""
      )}_${Date.now()}`,
      // Statement descriptor para aparecer na fatura (máximo 13 caracteres)
      statement_descriptor: event.title.substring(0, 13).toUpperCase(),
      metadata: {
        event_id: eventId,
        participant_name: participantData.name,
        participant_email: participantData.email,
        participant_cpf: participantData.cpf,
        participant_phone: participantData.phone,
        payment_method: paymentData.method,
        installments: paymentData.installments || 1,
        base_value: selectedOption.base_value,
        fee_amount: selectedOption.fee_amount,
        final_value: selectedOption.final_value,
        registration_id: targetRegistrationId, // Útil para rastreamento
      },
      // Forçar retorno automático quando pagamento for aprovado
      auto_return: "all",
      // Modo binário: aprovado ou rejeitado (sem pending para cartão)
      binary_mode: paymentData.method !== "pix", // PIX pode ficar pending
      payment_methods: {
        excluded_payment_types: getExcludedPaymentTypes(paymentData.method),
        excluded_payment_methods: getExcludedPaymentMethods(paymentData.method),
        installments:
          paymentData.method === "credit_card" &&
          selectedOption.final_value >= 5
            ? paymentData.installments || 1
            : 1,
        default_installments:
          paymentData.method === "credit_card" &&
          selectedOption.final_value >= 5
            ? paymentData.installments || 1
            : 1,
        max_installments:
          paymentData.method === "credit_card" &&
          selectedOption.final_value >= 5
            ? paymentData.installments || 1
            : 1,
      },
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
    };

    const response = await preference.create({ body: preferenceData });

    // 🔍 DEBUG: Log completo da resposta do MercadoPago
    console.log(
      "🔍 RESPONSE COMPLETO DO MERCADOPAGO:",
      JSON.stringify(response, null, 2)
    );
    console.log("🔍 CAMPOS IMPORTANTES:");
    console.log("  - response.id:", response.id);
    console.log("  - response.collector_id:", response.collector_id);
    console.log("  - response.client_id:", response.client_id);
    console.log("  - response.notification_url:", response.notification_url);
    console.log(
      "  - response.external_reference:",
      response.external_reference
    );

    // Criar ou atualizar registro baseado na ação determinada
    if (registrationAction === "UPDATE" && targetRegistrationId) {
      await prisma.registration.update({
        where: { id: targetRegistrationId },
        data: {
          // Atualizar dados do participante (caso tenham mudado)
          name: participantData.name,
          email: participantData.email,
          phone: participantData.phone.replace(/\D/g, ""),
          status: "PENDING",
          paymentId: response.id,
          // Atualiza dynamicFormData só quando o evento usa BOTH e veio no payload.
          // Caso contrário, preserva o valor antigo.
          ...(sanitizedDynamic
            ? { dynamicFormData: sanitizedDynamic as Prisma.InputJsonValue }
            : {}),
        },
      });
    } else {
      await prisma.registration.create({
        data: {
          eventId,
          name: participantData.name,
          email: participantData.email,
          cpf: participantData.cpf.replace(/\D/g, ""),
          phone: participantData.phone.replace(/\D/g, ""),
          status: "PENDING",
          paymentId: response.id,
          dynamicFormData: sanitizedDynamic
            ? (sanitizedDynamic as Prisma.InputJsonValue)
            : undefined,
        },
      });
    }

    return NextResponse.json({
      success: true,
      preferenceId: response.id,
      checkoutUrl: response.init_point,
      sandboxCheckoutUrl: response.sandbox_init_point,
      // Adicionar informações úteis para o frontend
      paymentInfo: {
        method: paymentData.method,
        installments: paymentData.installments || 1,
        finalValue: selectedOption.final_value,
        expiresAt: preferenceData.expiration_date_to,
      },
    });
  } catch (error) {
    console.error("Erro ao criar preferência:", error);

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
