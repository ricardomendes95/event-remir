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

    // Buscar informações do pagamento no Mercado Pago
    const payment = new Payment(mercadoPagoClient!);
    const paymentInfo = await payment.get({ id: paymentId });

    console.log("Informações do pagamento:", paymentInfo);

    if (!paymentInfo) {
      console.error("Pagamento não encontrado:", paymentId);
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Buscar registro no banco usando o preference_id
    const preferenceId = (paymentInfo as { preference_id?: string })
      .preference_id;
    const registration = await prisma.registration.findFirst({
      where: {
        paymentId: preferenceId,
      },
    });

    if (!registration) {
      console.error(
        "Registro não encontrado para preference_id:",
        preferenceId
      );
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      );
    }

    // Atualizar status do registro baseado no status do pagamento
    let newStatus: "PENDING" | "CONFIRMED" | "CANCELLED";

    switch (paymentInfo.status) {
      case "approved":
        newStatus = "CONFIRMED";
        break;
      case "rejected":
      case "cancelled":
        newStatus = "CANCELLED";
        break;
      case "pending":
      case "in_process":
      case "in_mediation":
      default:
        newStatus = "PENDING";
        break;
    }

    // Atualizar registro no banco
    await prisma.registration.update({
      where: {
        id: registration.id,
      },
      data: {
        status: newStatus,
        paymentId: paymentId.toString(), // Atualizar com o payment_id real
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
