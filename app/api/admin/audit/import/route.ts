import { NextRequest, NextResponse } from "next/server";
import { importStatement, AuditError } from "@/backend/services/audit/auditService";
import { auditErrorResponse, denyIfNotAdmin } from "@/backend/services/audit/routeHelpers";

const MAX_BYTES = 2 * 1024 * 1024;

// POST /api/admin/audit/import - Importa o extrato CSV do InfinitePay (multipart, campo "file")
export async function POST(request: NextRequest) {
  const denied = denyIfNotAdmin(request);
  if (denied) return denied;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AuditError("Envie o arquivo CSV do extrato.");
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      throw new AuditError("O arquivo precisa ser um .csv exportado do InfinitePay.");
    }
    if (file.size === 0) throw new AuditError("O arquivo está vazio.");
    if (file.size > MAX_BYTES) throw new AuditError("O arquivo é grande demais (máximo 2 MB).", 413);

    const result = await importStatement({
      text: await file.text(),
      fileName: file.name,
      userId: request.headers.get("x-user-id") ?? "",
      userName: request.headers.get("x-user-name"),
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return auditErrorResponse(error);
  }
}
