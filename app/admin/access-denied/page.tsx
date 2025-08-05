"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Result, Button } from "antd";

export default function AccessDeniedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Result
          status="403"
          title="403"
          subTitle="Acesso Negado. Você não tem permissão para acessar esta página."
          extra={
            <div className="space-y-2">
              <Button
                type="primary"
                onClick={() => router.push("/admin/login")}
              >
                Fazer Login
              </Button>
              <br />
              <Button onClick={() => router.push("/")}>Voltar ao Início</Button>
            </div>
          }
        />
      </div>
    </div>
  );
}
