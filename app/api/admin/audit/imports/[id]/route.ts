import { NextRequest, NextResponse } from "next/server";
import { getImportDetail } from "@/backend/services/audit/auditService";
import { auditErrorResponse, denyIfNotAdmin } from "@/backend/services/audit/routeHelpers";

// GET /api/admin/audit/imports/[id] - Linhas, resumo e inscrições sem recebimento
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = denyIfNotAdmin(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    return NextResponse.json({ success: true, data: await getImportDetail(id) });
  } catch (error) {
    return auditErrorResponse(error);
  }
}
