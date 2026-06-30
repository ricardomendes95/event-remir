import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  parseInfinitePayWebhook,
  isInfinitePayConfigured,
} from "@/backend/services/payment/infinitePayService";
import { resolveBaseValue } from "@/backend/utils/shirtPricing";

/**
 * Webhook do InfinitePay. Diferente do Mercado Pago, o payload já traz todos os
 * dados do pagamento (não há consulta externa). O InfinitePay só notifica
 * pagamentos aprovados, então confirmamos a inscrição correspondente.
 *
 * Conciliação: order_nsu === registration.id.
 * Repasse de taxa: paid_amount pode ser maior que amount (juros pagos pelo cliente).
 */
export async function POST(request: NextRequest) {
  try {
    if (!isInfinitePayConfigured()) {
      console.log("⚠️ Webhook InfinitePay recebido mas handle não configurado");
      return NextResponse.json({
        received: true,
        message: "InfinitePay não configurado",
      });
    }

    // O Checkout InfinitePay NÃO envia assinatura/HMAC no webhook. A validação
    // recomendada na doc oficial é: (1) conferir que o order_nsu corresponde a um
    // pedido real no nosso sistema e (2) conferir o valor esperado. Ambas abaixo.
    const body = await request.json();
    console.log("Webhook InfinitePay recebido:", body);

    const parsed = parseInfinitePayWebhook(body);
    if (!parsed) {
      console.error("Webhook InfinitePay sem order_nsu válido");
      return NextResponse.json(
        { error: "order_nsu missing" },
        { status: 400 }
      );
    }

    // Localiza a inscrição pelo order_nsu (= id) e, como fallback, pelo transaction_nsu.
    let registration = await withPrismaRetry(() =>
      prisma.registration.findUnique({ where: { id: parsed.orderNsu } })
    );

    if (!registration && parsed.transactionNsu) {
      registration = await withPrismaRetry(() =>
        prisma.registration.findFirst({
          where: { paymentId: parsed.transactionNsu },
          orderBy: { createdAt: "desc" },
        })
      );
    }

    if (!registration) {
      console.error(
        "❌ Inscrição não encontrada para order_nsu:",
        parsed.orderNsu
      );
      return NextResponse.json(
        { error: "Registration not found", orderNsu: parsed.orderNsu },
        { status: 404 }
      );
    }

    // Idempotência: se já está confirmada, apenas confirma recebimento.
    if (registration.status === "CONFIRMED") {
      return NextResponse.json({
        received: true,
        status: "CONFIRMED",
        registrationId: registration.id,
        message: "Já confirmada",
      });
    }

    // Conferência de valor: o valor pago deve cobrir o valor esperado da
    // inscrição (com/sem camisa). `amount` é o valor que enviamos; `paid_amount`
    // pode ser maior quando o repasse de taxa está ativo. Recusamos se for menor.
    const event = await withPrismaRetry(() =>
      prisma.event.findUnique({
        where: { id: registration!.eventId },
        select: { price: true, shirtConfig: true },
      })
    );
    if (event) {
      const expectedCents = Math.round(
        resolveBaseValue(event, registration.wantsShirt ?? false) * 100
      );
      const paidCents = parsed.paidAmount ?? parsed.amount;
      if (typeof paidCents === "number" && paidCents + 1 < expectedCents) {
        console.warn(
          `⚠️ Valor InfinitePay abaixo do esperado (pago ${paidCents}, esperado ${expectedCents}) para ${registration.id}`
        );
        return NextResponse.json(
          { error: "Valor pago inferior ao esperado" },
          { status: 422 }
        );
      }
    }

    const paymentDetails: Prisma.InputJsonValue = {
      gateway: "INFINITE_PAY",
      orderNsu: parsed.orderNsu,
      transactionNsu: parsed.transactionNsu ?? null,
      invoiceSlug: parsed.invoiceSlug ?? null,
      amount: parsed.amount ?? null,
      paidAmount: parsed.paidAmount ?? null,
      installments: parsed.installments ?? null,
      captureMethod: parsed.captureMethod ?? null,
      receiptUrl: parsed.receiptUrl ?? null,
      dateProcessed: new Date().toISOString(),
    };

    await withPrismaRetry(() =>
      prisma.registration.update({
        where: { id: registration!.id },
        data: {
          status: "CONFIRMED",
          paymentMethod: "INFINITE_PAY",
          paymentId: parsed.transactionNsu ?? parsed.orderNsu,
          paymentError: null,
          paymentDetails,
          updatedAt: new Date(),
        },
      })
    );

    console.log(
      `✅ Inscrição ${registration.id} confirmada via InfinitePay`
    );

    return NextResponse.json({
      received: true,
      status: "CONFIRMED",
      registrationId: registration.id,
    });
  } catch (error) {
    console.error("Erro no webhook InfinitePay:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// InfinitePay pode enviar GET para verificar se o endpoint está ativo
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "InfinitePay webhook endpoint is active",
  });
}
