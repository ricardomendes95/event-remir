import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  RefundRequestCreateSchema,
  RefundRequestWithdrawSchema,
} from "@/backend/schemas/refundSchemas";
import {
  createParticipantRequest,
  withdrawParticipantRequest,
} from "@/backend/services/refundService";
import {
  serviceFailureResponse,
  zodErrorResponse,
} from "@/backend/utils/validationResponse";

/**
 * Pedido de cancelamento pelo participante. Rota pública: exige o CPF da
 * própria inscrição e não devolve nenhum dado pessoal.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { cpf, reason } = RefundRequestCreateSchema.parse(
      await request.json()
    );
    const result = await createParticipantRequest(id, cpf, reason);
    if (!result.ok) return serviceFailureResponse(result);
    return NextResponse.json(
      {
        success: true,
        message: "Recebemos sua solicitação. Entraremos em contato.",
      },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}

/** Desistência do pedido enquanto ele ainda não foi resolvido. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { cpf } = RefundRequestWithdrawSchema.parse(await request.json());
    const result = await withdrawParticipantRequest(id, cpf);
    if (!result.ok) return serviceFailureResponse(result);
    return NextResponse.json({
      success: true,
      message: "Pedido de cancelamento encerrado. Sua inscrição segue ativa.",
    });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  if (error instanceof z.ZodError) return zodErrorResponse(error);
  console.error("Erro em /api/registrations/[id]/refund-request:", error);
  return NextResponse.json(
    { success: false, error: "Erro interno do servidor" },
    { status: 500 }
  );
}
