import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UpdateBatchPreferenceSchema } from "@/backend/schemas/batchRegistrationSchemas";
import {
  prepareOrderForPayment,
  saveOrderCheckout,
} from "@/backend/services/batchRegistrationService";
import { createInfinitePayCheckoutForOrder } from "@/backend/services/payment/infinitePayService";
import {
  batchZodErrorResponse,
  serviceFailureResponse,
} from "@/backend/utils/validationResponse";

/**
 * Continuar pagamento de um pedido em lote PENDING: gera um novo link com os
 * participantes atuais (após qualquer saída/recálculo). Dados não são editados.
 */
export async function POST(request: NextRequest) {
  try {
    const { orderId } = UpdateBatchPreferenceSchema.parse(
      await request.json()
    );

    const prepared = await prepareOrderForPayment(orderId);
    if (!prepared.ok) return serviceFailureResponse(prepared);
    const { snapshot } = prepared;
    const buyer = snapshot.active[0];

    try {
      const checkout = await createInfinitePayCheckoutForOrder({
        orderId,
        eventTitle: snapshot.order.event.title,
        participants: snapshot.items.map((i) => ({
          name: i.name,
          value: i.valueCents / 100,
        })),
        buyer: { name: buyer.name, email: buyer.email, phone: buyer.phone },
      });
      await saveOrderCheckout(orderId, checkout, snapshot.totalCents);

      return NextResponse.json({
        success: true,
        data: {
          gateway: "INFINITE_PAY",
          orderId,
          checkoutUrl: checkout.checkoutUrl,
          totalValue: snapshot.totalCents / 100,
          participants: snapshot.items.length,
        },
      });
    } catch (err) {
      console.error("Erro ao criar checkout InfinitePay do pedido:", err);
      return NextResponse.json(
        {
          success: false,
          error:
            "Não foi possível iniciar o pagamento agora. Tente novamente em instantes.",
        },
        { status: 502 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) return batchZodErrorResponse(error);
    console.error("Erro em /api/payments/update-batch-preference:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
