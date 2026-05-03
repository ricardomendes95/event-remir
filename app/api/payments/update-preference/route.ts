import { NextRequest, NextResponse } from "next/server";
import { Preference } from "mercadopago";
import {
  mercadoPagoClient,
  validateMercadoPagoConfig,
} from "@/lib/mercadopago";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PaymentFeeCalculator } from "@/backend/utils/paymentFeeCalculator";
import {
  PaymentConfig,
  updatePreferenceSchema,
} from "@/backend/schemas/eventSchemas";
import { parsePhoneNumber } from "../create-preference/route";

// Helper functions para mapear métodos de pagamento para exclusões do MercadoPago
function getExcludedPaymentTypes(selectedMethod: string) {
  switch (selectedMethod) {
    case "pix":
      return [{ id: "credit_card" }, { id: "debit_card" }, { id: "ticket" }];
    case "credit_card":
      return [{ id: "ticket" }];
    case "debit_card":
      return [{ id: "ticket" }];
    default:
      return [];
  }
}

function getExcludedPaymentMethods() {
  // Por enquanto, retornar array vazio
  // Pode ser expandido conforme necessário
  return [];
}

export async function PUT(request: NextRequest) {
  try {
    // 1. Validações iniciais
    validateMercadoPagoConfig();
    const body = await request.json();
    const { registrationId, paymentData } = updatePreferenceSchema.parse(body);

    console.log("🔄 INICIANDO ATUALIZAÇÃO DE PREFERÊNCIA:", {
      registrationId,
      paymentMethod: paymentData.method,
      installments: paymentData.installments,
    });

    // 2. Buscar inscrição existente
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        event: true,
      },
    });

    if (!registration) {
      return NextResponse.json(
        { error: "Inscrição não encontrada" },
        { status: 404 }
      );
    }

    // 3. Validar status da inscrição
    if (registration.status !== "PENDING") {
      return NextResponse.json(
        {
          error: "Esta inscrição não pode ser atualizada",
          current_status: registration.status,
        },
        { status: 400 }
      );
    }

    if (!registration.paymentId) {
      return NextResponse.json(
        { error: "Inscrição não possui ID de pagamento para atualizar" },
        { status: 400 }
      );
    }

    // 4. Buscar configuração de pagamento do evento
    const eventWithPaymentConfig = await prisma.event.findUnique({
      where: { id: registration.eventId },
      select: {
        paymentConfig: true,
      },
    });

    const eventPaymentConfig =
      eventWithPaymentConfig?.paymentConfig as PaymentConfig | null;

    // 5. Validar método de pagamento para o evento
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

    // 6. Calcular novo valor com taxas
    const paymentOptions = PaymentFeeCalculator.calculatePaymentOptions(
      registration.event.price,
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

    // 7. Validar valor mínimo para parcelamento
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

    // 8. Verificar se Mercado Pago está configurado
    if (!mercadoPagoClient) {
      return NextResponse.json(
        { error: "Sistema de pagamento não configurado" },
        { status: 500 }
      );
    }

    // Inscrição de evento pago sempre tem CPF/phone — validar defensivamente
    if (!registration.cpf || !registration.phone) {
      return NextResponse.json(
        { error: "Dados do participante incompletos para atualização de pagamento" },
        { status: 400 }
      );
    }

    // Extrair telefone de forma mais robusta
    const phoneData = parsePhoneNumber(registration.phone);

    // 9. Atualizar preferência no MercadoPago
    const preference = new Preference(mercadoPagoClient);

    const preferenceData = {
      items: [
        {
          id: registration.event.id,
          title: selectedOption.passthrough_fee
            ? `${registration.event.title} - ${selectedOption.description}`
            : registration.event.title,
          description: selectedOption.passthrough_fee
            ? `${
                registration.event.description
              } | Taxa de serviço: R$ ${selectedOption.fee_amount.toFixed(2)}`
            : registration.event.description,
          quantity: 1,
          unit_price: selectedOption.final_value,
          currency_id: "BRL",
        },
      ],
      payer: {
        name: registration.name ?? undefined,
        email: registration.email ?? undefined,
        identification: {
          type: "CPF",
          number: registration.cpf.replace(/\D/g, ""),
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
      external_reference: `event_${
        registration.eventId
      }_cpf_${registration.cpf!.replace(/\D/g, "")}_${Date.now()}`,
      // Statement descriptor para aparecer na fatura (máximo 13 caracteres)
      statement_descriptor: registration?.event?.title
        .substring(0, 13)
        .toUpperCase(),
      metadata: {
        registration_id: registrationId,
        event_id: registration.event.id,
        participant_name: registration.name,
        participant_email: registration.email,
        participant_cpf: registration.cpf,
        participant_phone: registration.phone,
        payment_method: paymentData.method,
        installments: paymentData.installments || 1,
        base_value: selectedOption.base_value,
        fee_amount: selectedOption.fee_amount,
        final_value: selectedOption.final_value,
        is_update: true, // Flag para identificar atualizações
      },
      // Forçar retorno automático ao site quando pagamento for aprovado
      auto_return: "all",
      binary_mode: paymentData.method !== "pix", // PIX pode ficar pending
      payment_methods: {
        excluded_payment_types: getExcludedPaymentTypes(paymentData.method),
        excluded_payment_methods: getExcludedPaymentMethods(),
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

    // 10. Executar atualização
    const response = await preference.update({
      id: registration.paymentId,
      updatePreferenceRequest: preferenceData,
    });

    // 11. Log para debug
    console.log("🔄 PREFERÊNCIA ATUALIZADA COM SUCESSO:", {
      registrationId,
      oldPaymentId: registration.paymentId,
      newPaymentId: response.id,
      method: paymentData.method,
      installments: paymentData.installments,
      baseValue: selectedOption.base_value,
      feeAmount: selectedOption.fee_amount,
      finalValue: selectedOption.final_value,
    });

    // 12. Atualizar registro com novo paymentId se necessário
    if (response.id !== registration.paymentId) {
      await prisma.registration.update({
        where: { id: registrationId },
        data: {
          paymentId: response.id,
        },
      });

      console.log("✅ REGISTRATION PAYMENTID ATUALIZADO:", {
        registrationId,
        newPaymentId: response.id,
      });
    }

    // 13. Retornar URLs de checkout
    return NextResponse.json({
      success: true,
      preferenceId: response.id,
      checkoutUrl: response.init_point,
      sandboxCheckoutUrl: response.sandbox_init_point,
      updated: true,
      paymentDetails: {
        method: paymentData.method,
        installments: paymentData.installments || 1,
        baseValue: selectedOption.base_value,
        feeAmount: selectedOption.fee_amount,
        finalValue: selectedOption.final_value,
      },
    });
  } catch (error) {
    console.error("❌ ERRO AO ATUALIZAR PREFERÊNCIA:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Dados inválidos",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // Log erro específico para debug
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
    }

    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        message:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : "Erro desconhecido"
            : "Erro interno",
      },
      { status: 500 }
    );
  }
}
