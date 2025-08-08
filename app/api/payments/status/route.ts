import { NextRequest, NextResponse } from "next/server";
import { Payment } from "mercadopago";
import { mercadoPagoClient } from "@/lib/mercadopago";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Verificar se Mercado Pago está configurado
    if (!mercadoPagoClient) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Sistema de pagamento não configurado - funcionando em modo mock",
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("paymentId");
    const registrationId = searchParams.get("registrationId");

    if (!paymentId && !registrationId) {
      return NextResponse.json(
        { error: "paymentId ou registrationId é obrigatório" },
        { status: 400 }
      );
    }

    let registration = null;

    // Buscar registro pelo ID da inscrição
    if (registrationId) {
      registration = await prisma.registration.findUnique({
        where: { id: registrationId },
        include: {
          event: true,
        },
      });
    }
    // Buscar registro pelo payment ID (preference_id)
    else if (paymentId) {
      registration = await prisma.registration.findFirst({
        where: { paymentId },
        include: {
          event: true,
        },
      });
    }

    if (!registration) {
      return NextResponse.json(
        { error: "Registro não encontrado" },
        { status: 404 }
      );
    }

    // Se já está confirmado, retornar status
    if (registration.status === "CONFIRMED") {
      return NextResponse.json({
        success: true,
        status: "approved",
        registration: {
          id: registration.id,
          name: registration.name,
          email: registration.email,
          event: registration.event.title,
          status: registration.status,
        },
      });
    }

    // Verificar status no Mercado Pago se ainda está pendente
    if (registration.paymentId) {
      try {
        const payment = new Payment(mercadoPagoClient);
        const paymentInfo = await payment.get({ id: registration.paymentId });

        if (paymentInfo) {
          // Atualizar status local se necessário
          let newStatus: "PENDING" | "CONFIRMED" | "CANCELLED" =
            registration.status;

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
            default:
              newStatus = "PENDING";
              break;
          }

          // Atualizar no banco se o status mudou
          if (newStatus !== registration.status) {
            await prisma.registration.update({
              where: { id: registration.id },
              data: {
                status: newStatus,
                updatedAt: new Date(),
              },
            });
          }

          return NextResponse.json({
            success: true,
            status: paymentInfo.status,
            registration: {
              id: registration.id,
              name: registration.name,
              email: registration.email,
              event: registration.event.title,
              status: newStatus,
              paymentStatus: paymentInfo.status,
            },
          });
        }
      } catch (mpError) {
        console.error("Erro ao consultar Mercado Pago:", mpError);
        // Continuar com o status local
      }
    }

    // Retornar status atual do banco
    return NextResponse.json({
      success: true,
      status: registration.status.toLowerCase(),
      registration: {
        id: registration.id,
        name: registration.name,
        email: registration.email,
        event: registration.event.title,
        status: registration.status,
      },
    });
  } catch (error) {
    console.error("Erro ao verificar status:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
