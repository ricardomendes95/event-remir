import { NextRequest, NextResponse } from "next/server";
import { Payment } from "mercadopago";
import { mercadoPagoClient } from "@/lib/mercadopago";
import { prisma } from "@/lib/prisma";
import { RegistrationStatus } from "@prisma/client";

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
    let paymentInfo;

    try {
      paymentInfo = await payment.get({ id: paymentId });
      console.log(
        "Informações do pagamento:",
        JSON.stringify(
          {
            id: paymentInfo.id,
            status: paymentInfo.status,
            preference_id: (paymentInfo as { preference_id?: string })
              .preference_id,
            external_reference: (paymentInfo as { external_reference?: string })
              .external_reference,
            order: (paymentInfo as { order?: { id?: string; type?: string } })
              .order,
          },
          null,
          2
        )
      );
    } catch (error) {
      console.error("Erro ao buscar pagamento no MercadoPago:", error);
      return NextResponse.json(
        {
          error: "Payment not found in MercadoPago",
          paymentId: paymentId,
          details: error,
        },
        { status: 404 }
      );
    }

    if (!paymentInfo) {
      console.error("Pagamento não encontrado:", paymentId);
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Buscar registro no banco usando múltiplas estratégias
    const preferenceId = (paymentInfo as { preference_id?: string })
      .preference_id;
    const orderId = (paymentInfo as { order?: { id?: string } }).order?.id;

    console.log("🔍 IDs disponíveis:", {
      paymentId: paymentId,
      preferenceId: preferenceId,
      orderId: orderId,
    });

    let registration = null;

    // 1. Tentar com payment_id direto
    console.log("🔍 Estratégia 1: Buscando pelo payment_id:", paymentId);
    registration = await prisma.registration.findFirst({
      where: {
        paymentId: paymentId.toString(),
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 2. Tentar com preference_id
    if (!registration && preferenceId) {
      console.log(
        "🔍 Estratégia 2: Buscando pelo preference_id:",
        preferenceId
      );
      registration = await prisma.registration.findFirst({
        where: {
          paymentId: preferenceId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    // 3. Tentar com order.id (relacionado ao preference)
    if (!registration && orderId) {
      console.log("🔍 Estratégia 3: Buscando pelo order.id:", orderId);
      registration = await prisma.registration.findFirst({
        where: {
          paymentId: orderId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    // 4. Buscar nos paymentDetails que contenham qualquer um dos IDs
    if (!registration) {
      console.log("🔍 Estratégia 4: Buscando nos paymentDetails");
      const allRegistrations = await prisma.registration.findMany({
        where: {
          status: "PENDING", // Só buscar em registros pendentes
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Filtrar manualmente os que contêm algum dos IDs
      const searchIds = [paymentId.toString()];
      if (preferenceId) searchIds.push(preferenceId);
      if (orderId) searchIds.push(orderId);

      const matchingRegistrations = allRegistrations.filter((reg) => {
        if (reg.paymentDetails && typeof reg.paymentDetails === "string") {
          return searchIds.some((id) =>
            reg.paymentDetails!.toString().includes(id)
          );
        }
        return false;
      });

      if (matchingRegistrations.length > 0) {
        registration = matchingRegistrations[0];
        console.log(
          `🔍 Encontrado ${matchingRegistrations.length} registro(s) com IDs nos detalhes, usando o mais recente`
        );
      }
    }

    if (!registration) {
      console.error(
        "❌ Registro não encontrado para payment_id:",
        paymentId,
        "ou preference_id:",
        (paymentInfo as { preference_id?: string }).preference_id
      );

      // Log adicional para debug em produção
      console.log("🔍 Debug: Listando últimos 5 registros para comparação:");
      const recentRegistrations = await prisma.registration.findMany({
        select: {
          id: true,
          name: true,
          paymentId: true,
          status: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      });

      recentRegistrations.forEach((reg) => {
        console.log(
          `- ID: ${reg.id}, PaymentId: ${reg.paymentId}, Status: ${reg.status}, Name: ${reg.name}`
        );
      });

      return NextResponse.json(
        {
          error: "Registration not found",
          paymentId: paymentId,
          preferenceId: (paymentInfo as { preference_id?: string })
            .preference_id,
          searchedIn: "paymentId field and paymentDetails",
        },
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
    let newStatus: RegistrationStatus;
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
