import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { canViewFinancialValues } from "@/lib/permissions";
import { AuditError } from "./auditService";

/** Auditoria expõe valores e nomes de pagadores: só ADMIN/SUPER_ADMIN. */
export function denyIfNotAdmin(request: NextRequest): NextResponse | null {
  if (canViewFinancialValues(request.headers.get("x-user-role"))) return null;
  return NextResponse.json({ success: false, error: "Acesso negado" }, { status: 403 });
}

export function auditErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuditError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: error.issues[0]?.message ?? "Dados inválidos",
        errors: error.issues.map((e) => ({ field: e.path.join("."), message: e.message })),
      },
      { status: 400 }
    );
  }
  console.error("Erro na auditoria:", error instanceof Error ? error.message : "desconhecido");
  return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
}
