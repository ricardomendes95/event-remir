import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyTokenEdge } from "./lib/jwt-edge";
import { canAccessPath } from "./lib/permissions";

// Rotas que requerem autenticação de admin
const adminRoutes = [
  "/admin",
  "/checkin",
  "/api/admin",
  "/api/events",
  "/api/upload",
  "/api/checkin",
  "/api/registrations",
];

// Rotas que devem redirecionar para login se não autenticado
const protectedRoutes = ["/admin", "/checkin"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas que não precisam de autenticação (exceções)
  const publicRoutes = [
    "/admin/login",
    "/admin/access-denied",
    "/api/events/active",
    "/api/events/list-active",
    "/api/payments/webhook/infinitepay",
    "/api/payments/create-preference",
    "/api/registrations/search-by-cpf",
    "/api/registrations/get-by-id",
    "/api/registrations/create-free",
    // Inscrição em lote: fluxo do participante, mesma superfície do individual.
    // Valores recalculados no servidor; respostas sem CPF/e-mail de terceiros.
    "/api/registrations/create-free-batch",
    "/api/payments/create-batch-preference",
    "/api/payments/update-batch-preference",
    "/payment/success",
    "/payment/failure",
    "/payment/pending",
  ]; // Verificar se é uma rota pública
  const isPublicRoute = publicRoutes.some((route) => pathname === route);

  // Verificar rotas dinâmicas públicas
  const isBySlugRoute = pathname.match(/^\/api\/events\/by-slug\/[^\/]+$/);
  // Sair de pedido em grupo: público, mas exige o CPF da própria inscrição
  const isLeaveOrderRoute = pathname.match(
    /^\/api\/registrations\/[^\/]+\/leave-order$/
  );

  // Pedido/desistência de cancelamento: público, mas exige o CPF da própria
  // inscrição e responde sem dados pessoais (mesma superfície da busca por CPF)
  const isRefundRequestRoute = pathname.match(
    /^\/api\/registrations\/[^\/]+\/refund-request$/
  );

  // Se for rota pública, deixar passar
  if (
    isPublicRoute ||
    isBySlugRoute ||
    isLeaveOrderRoute ||
    isRefundRequestRoute
  ) {
    return NextResponse.next();
  }

  // Verificar se é uma rota que precisa de proteção
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isAdminRoute || isProtectedRoute) {
    // Pegar token do header Authorization ou cookie
    const authHeader = request.headers.get("authorization");
    const tokenFromCookie = request.cookies.get("token")?.value;

    let token: string | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else if (tokenFromCookie) {
      token = tokenFromCookie;
    }

    if (!token) {
      // Se é uma rota de página (não API), redirecionar para login
      if (isProtectedRoute && !pathname.startsWith("/api/")) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/login";
        url.searchParams.set("redirect", pathname);
        return NextResponse.redirect(url);
      }

      // Se é API, retornar erro 401
      return NextResponse.json(
        {
          success: false,
          error: "Token de autenticação necessário",
        },
        { status: 401 }
      );
    }

    try {
      // Verificar se o token é válido
      const decoded = await verifyTokenEdge(token);

      // Verificar permissão por rota × método × perfil (lib/permissions.ts)
      if (
        isAdminRoute &&
        !canAccessPath(pathname, request.method, decoded.role)
      ) {
        // Se é uma rota de página, redirecionar para acesso negado
        if (!pathname.startsWith("/api/")) {
          const url = request.nextUrl.clone();
          url.pathname = "/admin/access-denied";
          return NextResponse.redirect(url);
        }

        // Se é API, retornar erro 403
        return NextResponse.json(
          {
            success: false,
            error: "Acesso negado - privilégios de administrador necessários",
          },
          { status: 403 }
        );
      }

      // Token válido, adicionar informações do usuário aos headers para as APIs
      const response = NextResponse.next();
      response.headers.set("x-user-id", decoded.id);
      response.headers.set("x-user-email", decoded.email);
      response.headers.set("x-user-role", decoded.role);
      if (decoded.name) {
        response.headers.set("x-user-name", decoded.name);
      }

      return response;
    } catch {
      // Token inválido
      if (isProtectedRoute && !pathname.startsWith("/api/")) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/login";
        url.searchParams.set("redirect", pathname);
        url.searchParams.set("error", "session-expired");
        return NextResponse.redirect(url);
      }

      return NextResponse.json(
        {
          success: false,
          error: "Token inválido ou expirado",
        },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

// Configurar quais rotas o middleware deve processar
export const config = {
  matcher: [
    // Rotas admin
    "/admin/:path*",
    // Rota de check-in
    "/checkin/:path*",
    // APIs protegidas
    "/api/admin/:path*",
    "/api/events/:path*",
    "/api/upload/:path*",
    "/api/checkin/:path*",
    "/api/registrations/:path*",
  ],
};
