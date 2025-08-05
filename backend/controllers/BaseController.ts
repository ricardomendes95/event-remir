import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export abstract class BaseController {
  protected success<T>(
    data: T,
    message?: string
  ): NextResponse<ApiResponse<T>> {
    return NextResponse.json(
      {
        success: true,
        data,
        message,
      },
      { status: 200 }
    );
  }

  protected created<T>(
    data: T,
    message?: string
  ): NextResponse<ApiResponse<T>> {
    return NextResponse.json(
      {
        success: true,
        data,
        message,
      },
      { status: 201 }
    );
  }

  protected noContent(): NextResponse {
    return new NextResponse(null, { status: 204 });
  }

  protected badRequest(
    message: string,
    errors?: Array<{ field: string; message: string }>
  ): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error: message,
        errors,
      },
      { status: 400 }
    );
  }

  protected unauthorized(
    message = "Não autorizado"
  ): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 401 }
    );
  }

  protected forbidden(message = "Acesso negado"): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 403 }
    );
  }

  protected notFound(
    message = "Recurso não encontrado"
  ): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 404 }
    );
  }

  protected conflict(message: string): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 409 }
    );
  }

  protected unprocessableEntity(
    message: string,
    errors?: Array<{ field: string; message: string }>
  ): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error: message,
        errors,
      },
      { status: 422 }
    );
  }

  protected internalServerError(
    message = "Erro interno do servidor"
  ): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }

  protected handleError(error: unknown): NextResponse<ApiResponse> {
    console.error("Controller Error:", error);

    if (error instanceof ZodError) {
      const errors = error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));

      return this.unprocessableEntity("Dados inválidos", errors);
    }

    if (error instanceof Error) {
      // Erros conhecidos da aplicação
      if (error.message.includes("não encontrado")) {
        return this.notFound(error.message);
      }

      if (
        error.message.includes("já existe") ||
        error.message.includes("duplicado")
      ) {
        return this.conflict(error.message);
      }

      if (error.message.includes("não autorizado")) {
        return this.unauthorized(error.message);
      }

      if (error.message.includes("acesso negado")) {
        return this.forbidden(error.message);
      }

      return this.badRequest(error.message);
    }

    return this.internalServerError();
  }

  protected async getRequestBody(request: NextRequest): Promise<unknown> {
    try {
      return await request.json();
    } catch {
      throw new Error("Corpo da requisição inválido");
    }
  }

  protected getQueryParam(request: NextRequest, param: string): string | null {
    const { searchParams } = new URL(request.url);
    return searchParams.get(param);
  }

  protected getQueryParams(request: NextRequest): Record<string, string> {
    const { searchParams } = new URL(request.url);
    const params: Record<string, string> = {};

    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    return params;
  }

  protected getPaginationParams(request: NextRequest): {
    page: number;
    limit: number;
    skip: number;
  } {
    const page = Math.max(
      1,
      parseInt(this.getQueryParam(request, "page") || "1")
    );
    const limit = Math.max(
      1,
      Math.min(100, parseInt(this.getQueryParam(request, "limit") || "10"))
    );
    const skip = (page - 1) * limit;

    return { page, limit, skip };
  }

  protected paginatedResponse<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
    message?: string
  ): NextResponse<
    ApiResponse<{
      items: T[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }>
  > {
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        items: data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
      message,
    });
  }

  protected extractUserFromRequest(request: NextRequest): {
    id: string;
    email: string;
    role: string;
  } | null {
    // Middleware de autenticação deve adicionar essas informações ao headers
    const userId = request.headers.get("x-user-id");
    const userEmail = request.headers.get("x-user-email");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !userEmail || !userRole) {
      return null;
    }

    return {
      id: userId,
      email: userEmail,
      role: userRole,
    };
  }

  protected requireAdmin(request: NextRequest): {
    id: string;
    email: string;
    role: string;
  } {
    const user = this.extractUserFromRequest(request);

    if (!user) {
      throw new Error("Usuário não autenticado");
    }

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      throw new Error(
        "Acesso negado - privilégios de administrador necessários"
      );
    }

    return user;
  }

  protected requireSuperAdmin(request: NextRequest): {
    id: string;
    email: string;
    role: string;
  } {
    const user = this.extractUserFromRequest(request);

    if (!user) {
      throw new Error("Usuário não autenticado");
    }

    if (user.role !== "SUPER_ADMIN") {
      throw new Error(
        "Acesso negado - privilégios de super administrador necessários"
      );
    }

    return user;
  }
}
