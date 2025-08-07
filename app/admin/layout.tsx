"use client";

import React from "react";
import { Layout } from "antd";
import { usePathname } from "next/navigation";
import AdminHeader from "./components/AdminHeader";

const { Content } = Layout;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Páginas que não devem ter o AdminHeader
  const pagesWithoutHeader = ["/admin/login", "/admin/access-denied"];
  const shouldShowHeader = !pagesWithoutHeader.includes(pathname);

  if (!shouldShowHeader) {
    return <>{children}</>;
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <AdminHeader />
      <Content
        style={{
          padding: 0,
          background: "#f5f5f5",
        }}
      >
        {children}
      </Content>
    </Layout>
  );
}
