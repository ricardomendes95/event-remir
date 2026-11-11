"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Avatar,
  Breadcrumb,
  Button,
  Drawer,
  Dropdown,
  Grid,
  Layout,
  Menu,
  Tag,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import { LogoutOutlined, MenuOutlined, UserOutlined } from "@ant-design/icons";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS, isAdminRole } from "@/lib/permissions";
import { activeMenuItem, menuForRole } from "./adminMenu";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const SIDER_WIDTH = 220;

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const screens = Grid.useBreakpoint();
  const { user, logout: authLogout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // `md` indefinido no primeiro render: trata como mobile até medir
  const isMobile = !screens.md;
  const items = menuForRole(user?.role);
  const active = activeMenuItem(pathname);
  const displayName = user?.name || "Admin";

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
    authLogout();
    router.push("/admin/login");
  };

  const menuItems: MenuProps["items"] = items.map((item) => {
    const Icon = item.icon;
    return {
      key: item.path,
      icon: <Icon />,
      label: item.label,
    };
  });

  const navigate: MenuProps["onClick"] = ({ key }) => {
    setDrawerOpen(false);
    router.push(key);
  };

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={active ? [active.path] : []}
      items={menuItems}
      onClick={navigate}
      style={{ borderInlineEnd: 0 }}
    />
  );

  const brand = (
    <Link
      href="/admin"
      style={{
        display: "block",
        padding: "16px 20px",
        fontWeight: 600,
        fontSize: 16,
        color: "#111827",
      }}
    >
      Event Manager
    </Link>
  );

  const breadcrumbItems = [
    { title: <Link href="/admin">Painel</Link> },
    ...(active && active.path !== "/admin" ? [{ title: active.label }] : []),
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {!isMobile && (
        <Sider
          width={SIDER_WIDTH}
          theme="light"
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          style={{
            borderRight: "1px solid #f0f0f0",
            position: "sticky",
            top: 0,
            height: "100vh",
            overflow: "auto",
          }}
        >
          {!collapsed && brand}
          {collapsed && <div style={{ height: 24 }} />}
          {menu}
        </Sider>
      )}

      <Drawer
        title="Event Manager"
        placement="left"
        open={isMobile && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={260}
        styles={{ body: { padding: 0 } }}
      >
        {menu}
      </Drawer>

      <Layout style={{ minWidth: 0 }}>
        <Header
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #f0f0f0",
            padding: "0 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {isMobile && (
              <Button
                type="text"
                size="large"
                aria-label="Abrir menu"
                icon={<MenuOutlined />}
                onClick={() => setDrawerOpen(true)}
              />
            )}
            <Text strong ellipsis style={{ fontSize: 16 }}>
              {active?.label ?? "Painel"}
            </Text>
          </div>

          <Dropdown
            trigger={["click"]}
            placement="bottomRight"
            menu={{
              items: [
                {
                  key: "logout",
                  icon: <LogoutOutlined />,
                  label: "Sair",
                  onClick: handleLogout,
                },
              ],
            }}
          >
            <Button type="text" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar size="small" icon={<UserOutlined />} />
              {!isMobile && <span>{displayName}</span>}
              {user && isAdminRole(user.role) && (
                <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                  {ROLE_LABELS[user.role]}
                </Tag>
              )}
            </Button>
          </Dropdown>
        </Header>

        <Content style={{ background: "#f5f5f5", minWidth: 0 }}>
          <Breadcrumb
            items={breadcrumbItems}
            style={{ padding: "12px 16px 0" }}
          />
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
