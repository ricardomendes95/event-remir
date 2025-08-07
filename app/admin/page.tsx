"use client";

import React from "react";
import { Card, Typography, Button, Space } from "antd";
import {
  CalendarOutlined,
  UserOutlined,
  DollarOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";

const { Title, Text } = Typography;

export default function AdminDashboard() {
  const router = useRouter();

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Title level={2}>Dashboard Administrativo</Title>
        <Text type="secondary">
          Bem-vindo ao sistema de gerenciamento de eventos
        </Text>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card
          className="text-center cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push("/admin/events")}
        >
          <CalendarOutlined className="text-3xl text-blue-500 mb-2" />
          <Title level={4}>Eventos</Title>
          <Text type="secondary">Gerenciar eventos</Text>
        </Card>

        <Card
          className="text-center cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push("/admin/registrations")}
        >
          <UserOutlined className="text-3xl text-green-500 mb-2" />
          <Title level={4}>Inscrições</Title>
          <Text type="secondary">Controlar inscrições</Text>
        </Card>

        <Card
          className="text-center cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push("/admin/financial")}
        >
          <DollarOutlined className="text-3xl text-yellow-500 mb-2" />
          <Title level={4}>Financeiro</Title>
          <Text type="secondary">Relatórios financeiros</Text>
        </Card>

        <Card
          className="text-center cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push("/admin/users")}
        >
          <SettingOutlined className="text-3xl text-purple-500 mb-2" />
          <Title level={4}>Usuários</Title>
          <Text type="secondary">Gerenciar usuários</Text>
        </Card>
      </div>

      <Card title="Próximas Funcionalidades" className="mb-6">
        <Space direction="vertical" size="middle" className="w-full">
          <div className="flex items-center justify-between p-4 bg-green-50 rounded">
            <div>
              <Title level={5} className="mb-1">
                FASE 4 - Gerenciamento de Eventos
              </Title>
              <Text type="secondary">CRUD de eventos, upload de imagens</Text>
            </div>
            <Button type="primary" onClick={() => router.push("/admin/events")}>
              Acessar
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
            <div>
              <Title level={5} className="mb-1">
                FASE 5 - Sistema de Inscrições
              </Title>
              <Text type="secondary">
                Formulário de inscrição e integração com pagamento
              </Text>
            </div>
            <Button disabled>Aguardando</Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
            <div>
              <Title level={5} className="mb-1">
                FASE 6 - Relatórios e Check-in
              </Title>
              <Text type="secondary">
                Sistema de check-in e relatórios financeiros
              </Text>
            </div>
            <Button disabled>Aguardando</Button>
          </div>
        </Space>
      </Card>

      <Card title="Status do Sistema">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded">
            <div className="text-green-600 font-semibold text-lg">
              ✅ Completo
            </div>
            <Text>Autenticação e Segurança</Text>
          </div>

          <div className="text-center p-4 bg-green-50 rounded">
            <div className="text-green-600 font-semibold text-lg">
              🚧 Em Desenvolvimento
            </div>
            <Text>Gerenciamento de Eventos</Text>
          </div>

          <div className="text-center p-4 bg-gray-50 rounded">
            <div className="text-gray-600 font-semibold text-lg">
              ⏳ Pendente
            </div>
            <Text>Sistema de Pagamentos</Text>
          </div>
        </div>
      </Card>
    </div>
  );
}
