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

/**
 * 422 de rotas em lote: erros do Zod com o índice do participante
 * (`participants.2.cpf` vira `{ index: 2, field: "cpf" }`).
 */
export function batchZodErrorResponse(error: ZodError) {
  const errors = error.issues.map((issue) => {
    const [root, idx, ...rest] = issue.path;
    if (root === "participants" && typeof idx === "number") {
      return {
        index: idx,
        field: rest.join(".") || "participant",
        message: issue.message,
      };
    }
    return { field: issue.path.join("."), message: issue.message };
  });
  return NextResponse.json(
    { success: false, error: "Dados inválidos", errors },
    { status: 422 }
  );
}

/** Falha de serviço no envelope padrão, mantendo `errors[]` por participante. */
export function serviceFailureResponse(failure: {
  status: number;
  error: string;
  errors?: unknown[];
}) {
  return NextResponse.json(
    {
      success: false,
      error: failure.error,
      ...(failure.errors ? { errors: failure.errors } : {}),
    },
    { status: failure.status }
  );
}
