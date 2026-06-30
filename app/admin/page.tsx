"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  Col,
  List,
  Progress,
  Row,
  Select,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CalendarOutlined,
  DollarOutlined,
  EyeOutlined,
  RiseOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";

dayjs.locale("pt-br");

const { Title, Text } = Typography;

interface DashboardKPIs {
  totalRegistrations: number;
  confirmedRevenue: number;
  activeEvents: number;
  last7DaysRegistrations: number;
}

interface UpcomingEvent {
  id: string;
  title: string;
  startDate: string;
  price: number;
  isFree: boolean;
  maxParticipants: number;
  confirmedCount: number;
  occupancyPercent: number;
}

interface RecentRegistration {
  id: string;
  name: string;
  status: string;
  paymentMethod: string;
  createdAt: string;
  eventTitle: string;
}

interface DashboardData {
  kpis: DashboardKPIs;
  upcomingEvents: UpcomingEvent[];
  recentRegistrations: RecentRegistration[];
}

interface TopPage {
  page: string;
  count: number;
}

interface PageViewData {
  totalViews: number;
  topPages: TopPage[];
}

const PERIOD_OPTIONS = [
  { label: "Últimos 7 dias", value: "7d" },
  { label: "Último mês", value: "30d" },
  { label: "Últimos 3 meses", value: "90d" },
  { label: "Últimos 6 meses", value: "180d" },
];

function getPeriodDates(period: string): { start: Date; end: Date } {
  const end = new Date();
  const days = parseInt(period);
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  CONFIRMED: { color: "green", label: "Confirmado" },
  PENDING: { color: "orange", label: "Pendente" },
  CANCELLED: { color: "red", label: "Cancelado" },
  PAYMENT_FAILED: { color: "red", label: "Falha" },
};

const PAYMENT_LABEL: Record<string, string> = {
  FREE: "Gratuito",
  MANUAL: "Manual",
  INFINITE_PAY: "InfinitePay",
  MERCADO_PAGO: "MercadoPago",
};

const NAV_ITEMS = [
  {
    path: "/admin/events",
    label: "Eventos",
    icon: <CalendarOutlined className="text-blue-500" />,
  },
  {
    path: "/admin/registrations",
    label: "Inscrições",
    icon: <UserOutlined className="text-green-500" />,
  },
  {
    path: "/admin/financial",
    label: "Financeiro",
    icon: <DollarOutlined className="text-yellow-500" />,
  },
  {
    path: "/admin/users",
    label: "Usuários",
    icon: <SettingOutlined className="text-purple-500" />,
  },
];

const upcomingColumns: ColumnsType<UpcomingEvent> = [
  {
    title: "Evento",
    dataIndex: "title",
    key: "title",
    ellipsis: true,
  },
  {
    title: "Data",
    dataIndex: "startDate",
    key: "startDate",
    width: 100,
    render: (v: string) => dayjs(v).format("DD/MM/YYYY"),
  },
  {
    title: "Preço",
    dataIndex: "price",
    key: "price",
    width: 90,
    render: (price: number, record: UpcomingEvent) =>
      record.isFree ? "Gratuito" : `R$ ${price.toFixed(2).replace(".", ",")}`,
  },
  {
    title: "Ocupação",
    key: "occupancy",
    width: 140,
    render: (_: unknown, record: UpcomingEvent) => {
      const strokeColor =
        record.occupancyPercent >= 90
          ? "#ff4d4f"
          : record.occupancyPercent >= 70
            ? "#faad14"
            : "#1890ff";
      return (
        <div>
          <Text style={{ fontSize: 12 }}>
            {record.confirmedCount}/{record.maxParticipants}
          </Text>
          <Progress
            percent={record.occupancyPercent}
            size="small"
            strokeColor={strokeColor}
            showInfo={false}
          />
        </div>
      );
    },
  },
];

const recentColumns: ColumnsType<RecentRegistration> = [
  {
    title: "Participante",
    key: "participant",
    ellipsis: true,
    render: (_: unknown, record: RecentRegistration) => (
      <div>
        <div style={{ fontWeight: 500 }}>{record.name}</div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.eventTitle}
        </Text>
      </div>
    ),
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    width: 100,
    render: (status: string) => {
      const cfg = STATUS_CONFIG[status] ?? { color: "default", label: status };
      return <Tag color={cfg.color}>{cfg.label}</Tag>;
    },
  },
  {
    title: "Método",
    dataIndex: "paymentMethod",
    key: "paymentMethod",
    width: 100,
    render: (method: string) => <Tag>{PAYMENT_LABEL[method] ?? method}</Tag>,
  },
  {
    title: "Data",
    dataIndex: "createdAt",
    key: "createdAt",
    width: 120,
    render: (v: string) => dayjs(v).format("DD/MM/YYYY HH:mm"),
  },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pvData, setPvData] = useState<PageViewData | null>(null);
  const [pvLoading, setPvLoading] = useState(true);
  const [pvPeriod, setPvPeriod] = useState("30d");

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setData(json.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPvLoading(true);
    const { start, end } = getPeriodDates(pvPeriod);
    const params = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
    });
    fetch(`/api/admin/dashboard/pageviews?${params}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setPvData(json.data);
      })
      .catch(console.error)
      .finally(() => setPvLoading(false));
  }, [pvPeriod]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "50vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Title level={2} style={{ marginBottom: 4 }}>
          Dashboard
        </Title>
        <Text type="secondary">Visão geral do sistema</Text>
      </div>
      {/* Navegação */}
      <Row gutter={[12, 12]} className="mb-6">
        {NAV_ITEMS.map((item) => (
          <Col key={item.path} xs={12} sm={6}>
            <Card
              size="small"
              className="text-center cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(item.path)}
            >
              <div className="text-xl mb-1">{item.icon}</div>
              <Text style={{ fontSize: 13, fontWeight: 500 }}>
                {item.label}
              </Text>
            </Card>
          </Col>
        ))}
      </Row>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total de Inscrições"
              value={data?.kpis.totalRegistrations ?? 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="Receita Confirmada"
              value={data?.kpis.confirmedRevenue ?? 0}
              precision={2}
              prefix={<DollarOutlined style={{ color: "#52c41a" }} />}
              valueStyle={{ color: "#52c41a" }}
              suffix="R$"
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="Eventos Ativos"
              value={data?.kpis.activeEvents ?? 0}
              prefix={<CalendarOutlined style={{ color: "#1890ff" }} />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="Inscrições (7 dias)"
              value={data?.kpis.last7DaysRegistrations ?? 0}
              prefix={<RiseOutlined style={{ color: "#722ed1" }} />}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabelas */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} lg={14}>
          <Card title="Próximos Eventos">
            <Table
              columns={upcomingColumns}
              dataSource={data?.upcomingEvents ?? []}
              rowKey="id"
              size="small"
              pagination={false}
              locale={{ emptyText: "Nenhum evento futuro ativo" }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Últimas Inscrições">
            <Table
              columns={recentColumns}
              dataSource={data?.recentRegistrations ?? []}
              rowKey="id"
              size="small"
              pagination={false}
              locale={{ emptyText: "Nenhuma inscrição encontrada" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Visualizações de Página */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={8}>
          <Card
            style={{ height: "100%" }}
            extra={
              <Select
                value={pvPeriod}
                onChange={setPvPeriod}
                options={PERIOD_OPTIONS}
                size="small"
                style={{ width: 160 }}
              />
            }
          >
            <Spin spinning={pvLoading}>
              <Statistic
                title="Visualizações de Página"
                value={pvData?.totalViews ?? 0}
                prefix={<EyeOutlined style={{ color: "#13c2c2" }} />}
                valueStyle={{ color: "#13c2c2" }}
              />
            </Spin>
          </Card>
        </Col>
        <Col xs={24} sm={16}>
          <Card title="Páginas Mais Visitadas">
            <Spin spinning={pvLoading}>
              <List
                size="small"
                dataSource={pvData?.topPages ?? []}
                locale={{ emptyText: "Sem dados no período" }}
                renderItem={(item, index) => (
                  <List.Item
                    extra={
                      <Tag color="cyan">
                        {item.count.toLocaleString("pt-BR")}
                      </Tag>
                    }
                  >
                    <Text
                      style={{ fontSize: 12, fontWeight: index === 0 ? 600 : 400 }}
                      ellipsis={{ tooltip: item.page }}
                    >
                      {item.page}
                    </Text>
                  </List.Item>
                )}
              />
            </Spin>
          </Card>
        </Col>
      </Row>

    </div>
  );
}
