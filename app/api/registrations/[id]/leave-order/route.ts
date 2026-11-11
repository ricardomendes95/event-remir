import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { LeaveOrderSchema } from "@/backend/schemas/batchRegistrationSchemas";
import { leaveOrder } from "@/backend/services/batchRegistrationService";
import {
  batchZodErrorResponse,
  serviceFailureResponse,
} from "@/backend/utils/validationResponse";

/**
 * Sai de um pedido em grupo com pagamento pendente. Rota pública: exige o CPF
 * da própria inscrição (mesma superfície da busca por CPF).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { cpf } = LeaveOrderSchema.parse(await request.json());

    const result = await leaveOrder(id, cpf);
    if (!result.ok) return serviceFailureResponse(result);

    return NextResponse.json({
      success: true,
      data: {
        registrationId: result.registrationId,
        orderId: result.orderId,
        orderCancelled: result.orderCancelled,
        newOrderTotal: result.newOrderTotal,
        remainingParticipants: result.remainingParticipants,
        individualAmount: result.individualAmount,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return batchZodErrorResponse(error);
    console.error("Erro em /api/registrations/[id]/leave-order:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
