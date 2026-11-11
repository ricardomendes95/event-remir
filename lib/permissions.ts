/**
 * Fonte única de verdade para perfis e permissões (ADR-002, docs/melhorias-2.0).
 *
 * IMPORTANTE: este módulo é importado pelo middleware (Edge Runtime), por
 * controllers (Node) e pelo frontend — não pode depender de APIs do Node.
 */

export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "CHECKIN" | "SUPPORT";

export const ALL_ROLES: AdminRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "CHECKIN",
  "SUPPORT",
];

/** Roles com acesso administrativo pleno (inclusive valores financeiros). */
export const FULL_ACCESS_ROLES: AdminRole[] = ["SUPER_ADMIN", "ADMIN"];

export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  CHECKIN: "Check-in",
  SUPPORT: "Suporte",
};

export function isAdminRole(role: string | null | undefined): role is AdminRole {
  return !!role && (ALL_ROLES as string[]).includes(role);
}

/** Apenas SUPER_ADMIN e ADMIN podem ver valores financeiros. */
export function canViewFinancialValues(role: string | null | undefined): boolean {
  return isAdminRole(role) && (FULL_ACCESS_ROLES as string[]).includes(role);
}

/** Observação administrativa e responsável pelo dinheiro: CHECKIN não vê. */
export function canViewRegistrationNotes(
  role: string | null | undefined
): boolean {
  return isAdminRole(role) && role !== "CHECKIN";
}

interface RouteRule {
  /** Prefixo do pathname (match por startsWith, primeira regra vence). */
  prefix: string;
  roles: AdminRole[];
  /** Se ausente, vale para todos os métodos HTTP. */
  methods?: string[];
}

/**
 * Matriz rota × perfil (ver docs/melhorias-2.0/melhorias/11-controle-permissoes.md).
 * A ORDEM importa: regras mais específicas vêm antes das mais genéricas.
 * Rotas públicas não passam por aqui (ver publicRoutes no middleware.ts).
 */
const routeRules: RouteRule[] = [
  // Páginas
  { prefix: "/admin/users", roles: ["SUPER_ADMIN"] },
  { prefix: "/admin/financial", roles: ["SUPER_ADMIN", "ADMIN"] },
  { prefix: "/admin/refund-requests", roles: ["SUPER_ADMIN", "ADMIN"] },
  { prefix: "/admin/events", roles: ["SUPER_ADMIN", "ADMIN", "SUPPORT"] },
  {
    prefix: "/admin/registrations",
    roles: ["SUPER_ADMIN", "ADMIN", "SUPPORT", "CHECKIN"],
  },
  { prefix: "/admin", roles: ALL_ROLES },
  { prefix: "/checkin", roles: ["SUPER_ADMIN", "ADMIN", "CHECKIN"] },

  // APIs
  { prefix: "/api/admin/users", roles: ["SUPER_ADMIN"] },
  { prefix: "/api/admin/financial", roles: ["SUPER_ADMIN", "ADMIN"] },
  { prefix: "/api/admin/refund-requests", roles: ["SUPER_ADMIN", "ADMIN"] },
  { prefix: "/api/admin/audit", roles: ["SUPER_ADMIN", "ADMIN"] },
  { prefix: "/api/admin/dashboard", roles: ALL_ROLES },
  { prefix: "/api/checkin", roles: ["SUPER_ADMIN", "ADMIN", "CHECKIN"] },
  { prefix: "/api/upload", roles: ["SUPER_ADMIN", "ADMIN", "SUPPORT"] },
  // Cobre /api/registrations/export e /api/registrations/export-admin
  { prefix: "/api/registrations/export", roles: ["SUPER_ADMIN", "ADMIN"] },
  { prefix: "/api/registrations/stats", roles: ALL_ROLES },
  {
    prefix: "/api/registrations",
    roles: ["SUPER_ADMIN", "ADMIN", "SUPPORT", "CHECKIN"],
    methods: ["GET"],
  },
  {
    prefix: "/api/registrations",
    roles: ["SUPER_ADMIN", "ADMIN", "SUPPORT"],
    methods: ["POST", "PUT", "PATCH"],
  },
  { prefix: "/api/registrations", roles: ["SUPER_ADMIN", "ADMIN"] },
  {
    prefix: "/api/events",
    roles: ["SUPER_ADMIN", "ADMIN", "SUPPORT"],
    methods: ["GET", "POST", "PUT", "PATCH"],
  },
  { prefix: "/api/events", roles: ["SUPER_ADMIN", "ADMIN"] },
  { prefix: "/api/auth/me", roles: ALL_ROLES },
];

export function allowedRolesForPath(
  pathname: string,
  method: string
): AdminRole[] | null {
  const normalizedMethod = method.toUpperCase();

  for (const rule of routeRules) {
    if (!pathname.startsWith(rule.prefix)) continue;
    if (rule.methods && !rule.methods.includes(normalizedMethod)) continue;
    return rule.roles;
  }

  return null;
}

/**
 * Decide se um role acessa uma rota protegida. Rota sem regra específica é
 * default deny: só SUPER_ADMIN/ADMIN passam.
 */
export function canAccessPath(
  pathname: string,
  method: string,
  role: string | null | undefined
): boolean {
  if (!isAdminRole(role)) return false;

  const allowed = allowedRolesForPath(pathname, method);
  if (!allowed) return (FULL_ACCESS_ROLES as string[]).includes(role);

  return allowed.includes(role);
}

/** Tela inicial de cada perfil após o login. */
export function homePathForRole(role: string | null | undefined): string {
  if (role === "CHECKIN") return "/checkin";
  return "/admin";
}
