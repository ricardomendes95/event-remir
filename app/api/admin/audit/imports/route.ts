import { NextRequest, NextResponse } from "next/server";
import { listImports } from "@/backend/services/audit/auditService";
import { auditErrorResponse, denyIfNotAdmin } from "@/backend/services/audit/routeHelpers";

// GET /api/admin/audit/imports - Histórico de importações
export async function GET(request: NextRequest) {
  const denied = denyIfNotAdmin(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ success: true, data: await listImports() });
  } catch (error) {
    return auditErrorResponse(error);
  }
}
