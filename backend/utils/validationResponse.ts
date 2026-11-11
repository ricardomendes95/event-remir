import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export type FieldError = { field: string; message: string };

/** Resposta 422 no envelope padrão, com `errors[]` por campo. */
export function validationErrorResponse(errors: FieldError[]) {
  return NextResponse.json(
    { success: false, error: "Dados inválidos", errors },
    { status: 422 }
  );
}

export function zodErrorResponse(error: ZodError) {
  return validationErrorResponse(
    error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }))
  );
}
