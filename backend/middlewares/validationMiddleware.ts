import { NextRequest, NextResponse } from "next/server";
import { ZodSchema, ZodError } from "zod";

export function validateBody<T>(schema: ZodSchema<T>) {
  return (
    handler: (req: NextRequest, validatedData: T) => Promise<NextResponse>
  ) => {
    return async (req: NextRequest): Promise<NextResponse> => {
      try {
        const body = await req.json();
        const validatedData = schema.parse(body);

        return await handler(req, validatedData);
      } catch (error) {
        if (error instanceof ZodError) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "VALIDATION_ERROR",
                message: "Dados inválidos",
                details: error.issues.map((issue) => ({
                  field: issue.path.join("."),
                  message: issue.message,
                })),
              },
            },
            { status: 400 }
          );
        }

        console.error("Validation middleware error:", error);
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Erro interno do servidor",
            },
          },
          { status: 500 }
        );
      }
    };
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (
    handler: (req: NextRequest, validatedQuery: T) => Promise<NextResponse>
  ) => {
    return async (req: NextRequest): Promise<NextResponse> => {
      try {
        const url = new URL(req.url);
        const queryParams = Object.fromEntries(url.searchParams.entries());
        const validatedQuery = schema.parse(queryParams);

        return await handler(req, validatedQuery);
      } catch (error) {
        if (error instanceof ZodError) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "VALIDATION_ERROR",
                message: "Parâmetros de consulta inválidos",
                details: error.issues.map((issue) => ({
                  field: issue.path.join("."),
                  message: issue.message,
                })),
              },
            },
            { status: 400 }
          );
        }

        console.error("Query validation middleware error:", error);
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Erro interno do servidor",
            },
          },
          { status: 500 }
        );
      }
    };
  };
}
