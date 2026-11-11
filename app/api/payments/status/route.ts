import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import {
  isOrderNsu,
  parseOrderNsu,
} from "@/backend/services/payment/infinitePayService";

/**
 * Status de uma compra em lote (order_nsu "ord_<id>"). Expõe só o necessário
 * para a tela de retorno do pagamento: sem CPF, e-mail ou telefone dos demais
 * participantes.
 */
async function getOrderStatus(orderNsu: string) {
  const order = await withPrismaRetry(() =>
    prisma.order.findUnique({
      where: { id: parseOrderNsu(orderNsu) },
      include: {
        event: { select: { title: true } },
        registrations: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true, name: true, email: true, status: true },
        },
      },
    })
  );

  if (!order) {
    return NextResponse.json(
      { error: "Registro não encontrado" },
      { status: 404 }
    );
  }

  // `registration` mantém o formato do fluxo individual (representa o
  // responsável pela compra) para a tela de retorno existente.
  const buyer = order.registrations[0];
  return NextResponse.json({
    success: true,
    status:
      order.status === "CONFIRMED" ? "approved" : order.status.toLowerCase(),
    registration: {
      id: buyer?.id ?? order.id,
      name: buyer?.name ?? "",
      email: buyer?.email ?? null,
      event: order.event.title,
      status: order.status,
    },
    order: {
      id: order.id,
      status: order.status,
      totalValue: order.totalValue,
      needsNewLink: order.status === "PENDING" && order.paymentId === null,
      participants: order.registrations.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
      })),
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("paymentId");
    const registrationId = searchParams.get("registrationId");

    if (!paymentId && !registrationId) {
      return NextResponse.json(
        { error: "paymentId ou registrationId é obrigatório" },
        { status: 400 }
      );
    }

    // Compra em lote: order_nsu prefixado (também aceito via paymentId)
    const orderRef = [registrationId, paymentId].find(
      (v): v is string => !!v && isOrderNsu(v)
    );
    if (orderRef) return await getOrderStatus(orderRef);

    // Buscar registro pelo ID da inscrição ou pela referência do provedor
    const registration = await withPrismaRetry(() =>
      registrationId
        ? prisma.registration.findUnique({
            where: { id: registrationId },
            include: { event: true },
          })
        : prisma.registration.findFirst({
            where: { paymentId },
            include: { event: true },
          })
    );

    if (!registration) {
      return NextResponse.json(
        { error: "Registro não encontrado" },
        { status: 404 }
      );
    }

    // A confirmação de pagamento chega exclusivamente pelo webhook do gateway.
    // Aqui retornamos o status persistido no banco.
    return NextResponse.json({
      success: true,
      status:
        registration.status === "CONFIRMED"
          ? "approved"
          : registration.status.toLowerCase(),
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
