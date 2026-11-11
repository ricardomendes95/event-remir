"use client";

import React from "react";
import { usePathname } from "next/navigation";
import AdminShell from "@/components/admin/shell/AdminShell";

// Telas fora do shell (sem menu)
const PAGES_WITHOUT_SHELL = ["/admin/login", "/admin/access-denied"];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (PAGES_WITHOUT_SHELL.includes(pathname)) {
    return <>{children}</>;
  }

  return <AdminShell>{children}</AdminShell>;
}
