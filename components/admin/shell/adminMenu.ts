import type { ComponentType } from "react";
import {
  CalendarOutlined,
  DashboardOutlined,
  DollarOutlined,
  QrcodeOutlined,
  RollbackOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { canAccessPath } from "@/lib/permissions";

export interface AdminMenuItem {
  path: string;
  label: string;
  icon: ComponentType;
  /** Mostrado também como atalho grande no dashboard. */
  shortcut?: boolean;
}

/**
 * Menu do painel. Não há matriz de perfis aqui: o que cada perfil enxerga é
 * derivado de `canAccessPath` (lib/permissions.ts), a fonte única.
 */
export const ADMIN_MENU: AdminMenuItem[] = [
  { path: "/admin", label: "Dashboard", icon: DashboardOutlined },
  { path: "/checkin", label: "Check-in", icon: QrcodeOutlined, shortcut: true },
  {
    path: "/admin/registrations",
    label: "Inscrições",
    icon: UserOutlined,
    shortcut: true,
  },
  {
    path: "/admin/events",
    label: "Eventos",
    icon: CalendarOutlined,
    shortcut: true,
  },
  {
    path: "/admin/financial",
    label: "Financeiro",
    icon: DollarOutlined,
    shortcut: true,
  },
  {
    path: "/admin/refund-requests",
    label: "Estornos",
    icon: RollbackOutlined,
    shortcut: true,
  },
  {
    path: "/admin/users",
    label: "Usuários",
    icon: SettingOutlined,
    shortcut: true,
  },
];

export function menuForRole(role: string | null | undefined): AdminMenuItem[] {
  return ADMIN_MENU.filter((item) => canAccessPath(item.path, "GET", role));
}

/** Item do menu que corresponde ao pathname (o prefixo mais específico vence). */
export function activeMenuItem(pathname: string): AdminMenuItem | undefined {
  return ADMIN_MENU.filter((item) =>
    item.path === "/admin"
      ? pathname === "/admin"
      : pathname === item.path || pathname.startsWith(`${item.path}/`)
  ).sort((a, b) => b.path.length - a.path.length)[0];
}
