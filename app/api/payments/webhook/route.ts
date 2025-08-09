import { NextRequest, NextResponse } from "next/server";
import { Payment } from "mercadopago";
import { mercadoPagoClient } from "@/lib/mercadopago";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // Verificar se Mercado Pago está configurado
    if (!mercadoPagoClient) {
      console.log(
        "⚠️ Webhook recebido mas Mercado Pago não configurado - ignorando"
      );
      return NextResponse.json({
        received: true,
        message: "Mercado Pago não configurado",
      });
    }

    // Verificar se é uma notificação do Mercado Pago
    const body = await request.json();

    console.log("Webhook recebido:", body);

    // Verificar se é uma notificação de pagamento
    if (body.type !== "payment") {
      return NextResponse.json({ received: true });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      console.error("Payment ID não encontrado no webhook");
      return NextResponse.json(
        { error: "Payment ID missing" },
        { status: 400 }
      );
    }

    // Verificar se é um webhook de teste do Mercado Pago
    if (paymentId === "123456" || body.live_mode === false) {
      console.log("📧 Webhook de teste recebido do Mercado Pago");
      return NextResponse.json({
        received: true,
        message: "Test webhook received successfully",
        test: true,
      });
    }

    // Buscar informações do pagamento no Mercado Pago
    const payment = new Payment(mercadoPagoClient!);
    const paymentInfo = await payment.get({ id: paymentId });

    console.log("Informações do pagamento:", paymentInfo);

    if (!paymentInfo) {
      console.error("Pagamento não encontrado:", paymentId);
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Primeiro, tentar buscar pelo payment_id real
    console.log("🔍 Buscando registro pelo payment_id:", paymentId);
    let registration = await prisma.registration.findFirst({
      where: {
        paymentId: paymentId.toString(),
      },
    });

    // Se não encontrou pelo payment_id, buscar pelo preference_id
    if (!registration) {
      const preferenceId = (paymentInfo as { preference_id?: string })
        .preference_id;

      console.log(
        "🔍 Payment_id não encontrado, buscando pelo preference_id:",
        preferenceId
      );

      if (preferenceId) {
        // Buscar pelo preference_id, mas ordenar por createdAt DESC para pegar o mais recente
        registration = await prisma.registration.findFirst({
          where: {
            paymentId: preferenceId,
          },
          orderBy: {
            createdAt: "desc",
          },
        });
      }
    }

    if (!registration) {
      console.error(
        "❌ Registro não encontrado para payment_id:",
        paymentId,
        "ou preference_id:",
        (paymentInfo as { preference_id?: string }).preference_id
      );
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      );
    }

    console.log("✅ Registro encontrado:", {
      id: registration.id,
      name: registration.name,
      email: registration.email,
      cpf: registration.cpf,
      currentPaymentId: registration.paymentId,
      status: registration.status,
    });

    // Atualizar status do registro baseado no status do pagamento
    let newStatus: string;
    let paymentError: string | null = null;

    switch (paymentInfo.status) {
      case "approved":
        newStatus = "CONFIRMED";
        break;
      case "rejected":
        newStatus = "PAYMENT_FAILED";
        paymentError = `Pagamento rejeitado: ${
          paymentInfo.status_detail || "Motivo não especificado"
        }`;
        break;
      case "cancelled":
        newStatus = "CANCELLED";
        paymentError = `Pagamento cancelado: ${
          paymentInfo.status_detail || "Cancelado pelo usuário"
        }`;
        break;
      case "pending":
      case "in_process":
      case "in_mediation":
        newStatus = "PENDING";
        break;
      default:
        newStatus = "PENDING";
        console.log(`Status desconhecido: ${paymentInfo.status}`);
        break;
    }

    // Atualizar registro no banco
    // @ts-expect-error - Tipos do Prisma com problemas temporários
    await prisma.registration.update({
      where: {
        id: registration.id,
      },
      data: {
        status: newStatus,
        paymentId: paymentId.toString(), // Atualizar com o payment_id real
        paymentError,
        paymentDetails: {
          paymentId: paymentId,
          status: paymentInfo.status,
          statusDetail: (paymentInfo as { status_detail?: string })
            .status_detail,
          paymentMethod: (paymentInfo as { payment_method_id?: string })
            .payment_method_id,
          transactionAmount: (paymentInfo as { transaction_amount?: number })
            .transaction_amount,
          dateProcessed:
            (paymentInfo as { date_approved?: string }).date_approved ||
            new Date().toISOString(),
          payer: {
            email: (paymentInfo as { payer?: { email?: string } }).payer?.email,
            identification: (
              paymentInfo as {
                payer?: { identification?: { type?: string; number?: string } };
              }
            ).payer?.identification,
          },
        },
        updatedAt: new Date(),
      },
    });

    console.log(
      `Registro ${registration.id} atualizado para status: ${newStatus}`
    );

    // TODO: Enviar email de confirmação se aprovado
    if (newStatus === "CONFIRMED") {
      console.log(`Pagamento aprovado para ${registration.email}`);
      // Aqui seria implementado o envio de email
    }

    return NextResponse.json({
      received: true,
      status: newStatus,
      registrationId: registration.id,
    });
  } catch (error) {
    console.error("Erro no webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Mercado Pago pode enviar GET requests para verificar se o endpoint está ativo
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Webhook endpoint is active",
  });
}
