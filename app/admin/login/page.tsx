"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, Alert, Typography } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import {
  LoginSchema,
  type LoginData,
} from "../../../backend/schemas/authSchemas";

const { Title, Text } = Typography;

export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);

  // React Hook Form com validação Zod
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginData>({
    resolver: zodResolver(LoginSchema),
  });

  // Verifica se o usuário já está logado
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      // Se já está logado, redireciona direto para o admin
      router.push("/admin");
      return;
    }

    // Verifica se chegou aqui por expiração de sessão
    const params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "true") {
      setSessionExpired(true);
      localStorage.removeItem("token");
    }
  }, [router]);

  const handleLogin = async (values: LoginData) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        // Se houver erros de validação específicos
        if (data.errors && Array.isArray(data.errors)) {
          const errorMessage = data.errors
            .map((err: { field: string; message: string }) => err.message)
            .join(", ");
          throw new Error(errorMessage);
        }

        throw new Error(data.message || data.error || "Erro ao fazer login");
      }

      // Salva o token no localStorage
      localStorage.setItem("token", data.data.token);

      // Redireciona para o dashboard admin
      router.push("/admin");
    } catch (err) {
      console.error("Erro no login:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Title level={2} className="text-center">
            Login Administrativo
          </Title>
          <Text className="text-center text-gray-600 block">
            Sistema de Gerenciamento de Eventos
          </Text>
        </div>

        <Card>
          {sessionExpired && (
            <Alert
              message="Sessão Expirada"
              description="Sua sessão expirou. Por favor, faça login novamente."
              type="warning"
              closable
              onClose={() => setSessionExpired(false)}
              className="mb-4"
            />
          )}

          {error && (
            <Alert
              message={error}
              type="error"
              closable
              onClose={() => setError("")}
              className="mb-4"
            />
          )}

          <form onSubmit={handleSubmit(handleLogin)} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <div className="relative">
                <UserOutlined className="absolute left-3 top-3 text-gray-400" />
                <input
                  {...register("email")}
                  id="email"
                  type="email"
                  placeholder="admin@eventremir.com"
                  className={`w-full pl-10 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.email ? "border-red-500" : "border-gray-300"
                  }`}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Senha
              </label>
              <div className="relative">
                <LockOutlined className="absolute left-3 top-3 text-gray-400" />
                <input
                  {...register("password")}
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.password ? "border-red-500" : "border-gray-300"
                  }`}
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              block
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
            <Text strong className="text-blue-800">
              Credenciais de Teste:
            </Text>
            <br />
            <Text className="text-blue-700">Email: admin@eventremir.com</Text>
            <br />
            <Text className="text-blue-700">Senha: admin123</Text>
          </div>
        </Card>
      </div>
    </div>
  );
}
