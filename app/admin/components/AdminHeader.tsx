"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Layout, Button, Typography, Avatar, Dropdown } from "antd";
import {
  LogoutOutlined,
  UserOutlined,
  SettingOutlined,
  QrcodeOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { useAuth } from "../../../hooks/useAuth";

const { Header } = Layout;
const { Text } = Typography;

interface AdminHeaderProps {
  // Propriedade adminName agora é opcional, pois vamos obter do token
  adminName?: string;
}

export default function AdminHeader({ adminName }: AdminHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [screenWidth, setScreenWidth] = useState(0);
  const { user, logout: authLogout } = useAuth();

  // Usar nome do token JWT, com fallback para prop ou "Admin"
  const displayName = user?.name || adminName || "Admin";

  // Hook para detectar tamanho da tela
  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    // Set initial width
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Verifica se não está na home do admin
  const isNotAdminHome = pathname !== "/admin";

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        // Usar o logout do hook para limpar o estado local
        authLogout();
        router.push("/admin/login");
      } else {
        console.error("Erro ao fazer logout");
      }
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      // Mesmo em caso de erro, limpar estado local e redirecionar
      authLogout();
      router.push("/admin/login");
    }
  };

  const handleBackToAdmin = () => {
    router.push("/admin");
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
    <Header
      style={{
        backgroundColor: "#ffffff",
        borderBottom: "2px solid #d1d5db",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        padding: "0 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "64px",
      }}
    >
      {/* Seção esquerda */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flex: 1,
          minWidth: 0,
        }}
      >
        {/* Botão voltar - aparece apenas quando não está na home do admin */}
        {isNotAdminHome && (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleBackToAdmin}
            size="large"
            style={{
              color: "#374151",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
        )}

        {/* Título - responsivo */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text
            strong
            style={{
              color: "#111827",
              fontSize: screenWidth >= 768 ? "18px" : "14px",
              fontWeight: 600,
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {screenWidth >= 640
              ? "Sistema de Gerenciamento de Eventos"
              : "Event Manager"}
          </Text>
        </div>
      </div>

      {/* Seção direita */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {/* Botão Check-in */}
        <Button
          type="primary"
          icon={<QrcodeOutlined />}
          onClick={() => router.push("/checkin")}
          size="middle"
          style={{
            backgroundColor: "#2563eb",
            borderColor: "#2563eb",
            color: "white",
            fontWeight: 500,
            display: screenWidth >= 640 ? "flex" : "none",
            alignItems: "center",
          }}
        >
          {screenWidth >= 768 && (
            <span style={{ marginLeft: "4px" }}>Check-in</span>
          )}
        </Button>

        {/* Versão mobile do botão Check-in */}
        <Button
          type="primary"
          icon={<QrcodeOutlined />}
          onClick={() => router.push("/checkin")}
          size="middle"
          style={{
            backgroundColor: "#2563eb",
            borderColor: "#2563eb",
            color: "white",
            display: screenWidth < 640 ? "inline-flex" : "none",
          }}
        />

        {/* Nome do usuário - oculto em mobile muito pequeno */}
        <Text
          style={{
            color: "#374151",
            fontSize: "14px",
            fontWeight: 500,
            display: screenWidth >= 640 ? "inline" : "none",
          }}
        >
          Olá, {displayName}
        </Text>

        {/* Dropdown do usuário */}
        <Dropdown
          menu={{ items: menuItems }}
          placement="bottomRight"
          trigger={["click"]}
        >
          <Button
            type="text"
            size="middle"
            style={{
              display: "flex",
              alignItems: "center",
              color: "#111827",
              border: "none",
              padding: "4px 8px",
            }}
          >
            <Avatar
              size="small"
              icon={<UserOutlined />}
              style={{
                backgroundColor: "#3b82f6",
                color: "white",
              }}
            />
            {screenWidth >= 768 && (
              <span
                style={{
                  marginLeft: "4px",
                  fontSize: "14px",
                  color: "#374151",
                  fontWeight: 500,
                }}
              >
                {displayName}
              </span>
            )}
          </Button>
        </Dropdown>
      </div>
    </Header>
  );
}
