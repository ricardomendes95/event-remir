import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { CreateBatchPreferenceSchema } from "@/backend/schemas/batchRegistrationSchemas";
import {
  createPaidBatchOrder,
  saveOrderCheckout,
} from "@/backend/services/batchRegistrationService";
import { createInfinitePayCheckoutForOrder } from "@/backend/services/payment/infinitePayService";
import {
  batchZodErrorResponse,
  serviceFailureResponse,
} from "@/backend/utils/validationResponse";

/**
 * Inscrição em lote paga: N participantes, 1 Order, 1 checkout.
 * Rota pública (fluxo do participante); valores sempre recalculados aqui.
 */
export async function POST(request: NextRequest) {
  try {
    const { eventId, participants } = CreateBatchPreferenceSchema.parse(
      await request.json()
    );

    const event = await withPrismaRetry(() =>
      prisma.event.findUnique({ where: { id: eventId } })
    );
    if (!event) {
      return NextResponse.json(
        { success: false, error: "Evento não encontrado" },
        { status: 404 }
      );
    }

    const created = await createPaidBatchOrder(event, participants);
    if (!created.ok) return serviceFailureResponse(created);

    try {
      const checkout = await createInfinitePayCheckoutForOrder({
        orderId: created.order.id,
        eventTitle: event.title,
        participants: created.items.map((i) => ({
          name: i.name,
          value: i.value,
        })),
        buyer: created.buyer,
      });
      await saveOrderCheckout(
        created.order.id,
        checkout,
        created.order.totalCents
      );

      return NextResponse.json(
        {
          success: true,
          data: {
            gateway: "INFINITE_PAY",
            orderId: created.order.id,
            checkoutUrl: checkout.checkoutUrl,
            totalValue: created.order.totalValue,
            batchName: created.batchName,
            registrations: created.items.map((i) => ({
              id: i.registrationId,
              name: i.name,
              value: i.value,
            })),
          },
        },
        { status: 201 }
      );
    } catch (err) {
      console.error("Erro ao criar checkout InfinitePay do lote:", err);
      // Pedido e inscrições já estão PENDING: o cliente retoma por
      // /api/payments/update-batch-preference sem duplicar nada.
      return NextResponse.json(
        {
          success: false,
          error:
            "Não foi possível iniciar o pagamento agora. Tente novamente em instantes.",
          data: { orderId: created.order.id },
        },
        { status: 502 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) return batchZodErrorResponse(error);
    console.error("Erro em /api/payments/create-batch-preference:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
