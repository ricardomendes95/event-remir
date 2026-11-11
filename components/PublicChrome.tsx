"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";

// Áreas internas (admin e check-in) têm moldura própria: sem o cabeçalho e o
// rodapé do site público.
const INTERNAL_PREFIXES = ["/admin", "/checkin"];

export function PublicChrome({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const isInternal = INTERNAL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isInternal) {
    return <div className="flex-1">{children}</div>;
  }

  return (
    <>
      <Header />
      <div className="mt-16 lg:mt-20 flex-1">{children}</div>
      {footer}
    </>
  );
}
