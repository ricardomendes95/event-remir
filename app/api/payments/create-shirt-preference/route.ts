import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CreateShirtPreferenceSchema } from "@/backend/schemas/shirtPurchaseSchemas";
import { createOrReuseShirtOrder } from "@/backend/services/shirtPurchaseService";
import { saveOrderCheckout } from "@/backend/services/batchRegistrationService";
import { createInfinitePayCheckoutForOrder } from "@/backend/services/payment/infinitePayService";
import {
  serviceFailureResponse,
  zodErrorResponse,
} from "@/backend/utils/validationResponse";

/**
 * Compra posterior da camisa por inscrito confirmado. Rota pública: exige o
 * CPF da própria inscrição, o valor é sempre recalculado aqui e a resposta
 * traz só o link de pagamento (sem dados pessoais). Pedido de camisa pendente
 * é reaproveitado, nunca duplicado.
 */
export async function POST(request: NextRequest) {
  try {
    const input = CreateShirtPreferenceSchema.parse(await request.json());

    const prepared = await createOrReuseShirtOrder(input);
    if (!prepared.ok) return serviceFailureResponse(prepared);

    try {
      const checkout = await createInfinitePayCheckoutForOrder({
        orderId: prepared.order.id,
        eventTitle: prepared.eventTitle,
        itemLabel: "Camisa",
        participants: [
          {
            name: `Tam. ${prepared.shirtSize}`,
            value: prepared.order.totalValue,
          },
        ],
        buyer: prepared.buyer,
      });
      await saveOrderCheckout(
        prepared.order.id,
        checkout,
        prepared.order.totalCents
      );

      return NextResponse.json(
        {
          success: true,
          data: {
            gateway: "INFINITE_PAY",
            orderId: prepared.order.id,
            checkoutUrl: checkout.checkoutUrl,
            totalValue: prepared.order.totalValue,
            reused: prepared.reused,
          },
        },
        { status: prepared.reused ? 200 : 201 }
      );
    } catch (err) {
      console.error("Erro ao criar checkout InfinitePay da camisa:", err);
      // O pedido fica PENDING: tocar de novo reaproveita o mesmo pedido.
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
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    console.error("Erro em /api/payments/create-shirt-preference:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
