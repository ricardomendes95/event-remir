import { NextRequest } from "next/server";
import { refundRequestController } from "@/backend/controllers/RefundRequestController";

// GET /api/admin/refund-requests - Listar solicitações de estorno
export async function GET(request: NextRequest) {
  return refundRequestController.list(request);
}
