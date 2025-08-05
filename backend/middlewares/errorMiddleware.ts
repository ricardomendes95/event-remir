import { NextRequest, NextResponse } from "next/server";

export function errorHandler(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(req);
    } catch (error) {
      console.error("Unhandled error:", error);

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message:
              process.env.NODE_ENV === "development"
                ? `Erro interno: ${error}`
                : "Erro interno do servidor",
          },
        },
        { status: 500 }
      );
    }
  };
}

export function cors(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // Handle preflight requests
    if (req.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin":
            process.env.NODE_ENV === "development"
              ? "*"
              : "https://your-domain.com",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const response = await handler(req);

    // Add CORS headers to all responses
    response.headers.set(
      "Access-Control-Allow-Origin",
      process.env.NODE_ENV === "development" ? "*" : "https://your-domain.com"
    );
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    return response;
  };
}

export function rateLimit(
  requests: number = 100,
  windowMs: number = 15 * 60 * 1000
) {
  const clients = new Map<string, { count: number; resetTime: number }>();

  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    return async (req: NextRequest): Promise<NextResponse> => {
      const clientIp =
        req.headers.get("x-forwarded-for") ||
        req.headers.get("x-real-ip") ||
        "unknown";
      const now = Date.now();

      const client = clients.get(clientIp);

      if (!client || now > client.resetTime) {
        clients.set(clientIp, { count: 1, resetTime: now + windowMs });
        return await handler(req);
      }

      if (client.count >= requests) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: "Muitas requisições. Tente novamente mais tarde.",
            },
          },
          { status: 429 }
        );
      }

      client.count++;
      return await handler(req);
    };
  };
}
