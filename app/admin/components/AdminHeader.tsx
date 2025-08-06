"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Layout, Button, Typography, Space, Avatar, Dropdown } from "antd";
import {
  LogoutOutlined,
  UserOutlined,
  SettingOutlined,
  QrcodeOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";

const { Header } = Layout;
const { Text } = Typography;

interface AdminHeaderProps {
  adminName?: string;
}

export default function AdminHeader({ adminName = "Admin" }: AdminHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        localStorage.removeItem("token");
        router.push("/admin/login");
      } else {
        console.error("Erro ao fazer logout");
      }
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  const menuItems: MenuProps["items"] = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "Perfil",
      onClick: () => console.log("Abrir perfil"),
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: "Configurações",
      onClick: () => console.log("Abrir configurações"),
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Sair",
      onClick: handleLogout,
    },
  ];

  return (
    <Header className="bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      <div>
        <Text strong className="text-lg">
          Sistema de Gerenciamento de Eventos
        </Text>
      </div>

      <Space>
        <Button
          type="primary"
          icon={<QrcodeOutlined />}
          onClick={() => router.push("/checkin")}
        >
          Check-in
        </Button>
        <Text>Olá, {adminName}</Text>
        <Dropdown
          menu={{ items: menuItems }}
          placement="bottomRight"
          trigger={["click"]}
        >
          <Button
            type="text"
            icon={<Avatar size="small" icon={<UserOutlined />} />}
            className="flex items-center"
          >
            <span className="ml-1">{adminName}</span>
          </Button>
        </Dropdown>
      </Space>
    </Header>
  );
}
