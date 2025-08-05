import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../utils/jwt";
import { JWTPayload } from "../types/auth";

export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload;
}

export function authMiddleware(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (req: AuthenticatedRequest): Promise<NextResponse> => {
    try {
      const authHeader = req.headers.get("authorization");

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "AUTH_ERROR",
              message: "Token de autorização não fornecido",
            },
          },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7); // Remove "Bearer "

      try {
        const decoded = verifyToken(token);
        req.user = decoded;

        return await handler(req);
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "AUTH_ERROR",
              message: "Token inválido ou expirado",
            },
          },
          { status: 401 }
        );
      }
    } catch (error) {
      console.error("Auth middleware error:", error);
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
}

export function requireAdmin(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return authMiddleware(async (req: AuthenticatedRequest) => {
    if (
      !req.user ||
      (req.user.role !== "ADMIN" && req.user.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Acesso negado. Privilégios de administrador necessários.",
          },
        },
        { status: 403 }
      );
    }

    return await handler(req);
  });
}
