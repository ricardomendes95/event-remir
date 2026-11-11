import { NextRequest } from "next/server";
import { refundRequestController } from "@/backend/controllers/RefundRequestController";

// PATCH /api/admin/refund-requests/[id] - Contato, negar, estornar, reativar
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return refundRequestController.update(request, id);
}
