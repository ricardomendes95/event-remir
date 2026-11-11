"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  List,
  Progress,
  Row,
  Select,
  Skeleton,
  Spin,
  Statistic,
  Tag,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  EyeOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  RollbackOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import { canViewFinancialValues } from "../../lib/permissions";
import { menuForRole } from "../../components/admin/shell/adminMenu";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";

dayjs.locale("pt-br");

const { Title, Text } = Typography;

// Mesma chave da tela de inscrições (req. 9): o evento escolhido é lembrado na sessão
const EVENT_STORAGE_KEY = "admin.registrations.eventId";

interface EventOption {
  id: string;
  title: string;
  startDate: string;
  isActive: boolean;
}

interface DashboardData {
  events: EventOption[];
  selectedEventId: string | null;
  event: {
    id: string;
    title: string;
    startDate: string;
    isActive: boolean;
    isFree: boolean;
    maxParticipants: number;
    hasShirt: boolean;
  } | null;
  stats?: {
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    spotsLeft: number;
    checkedIn: number;
  };
  shirtsBySize?: { size: string; count: number }[];
  recentRegistrations?: {
    id: string;
    name: string;
    status: string;
    paymentMethod: string;
    createdAt: string;
  }[];
  // Só presente para SUPER_ADMIN/ADMIN
  financial?: { net: number; gross: number; openRefunds: number };
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

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function readSavedEventId(): string | null {
  try {
    return sessionStorage.getItem(EVENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pvData, setPvData] = useState<PageViewData | null>(null);
  const [pvLoading, setPvLoading] = useState(true);
  const [pvPeriod, setPvPeriod] = useState("30d");

  const loadDashboard = useCallback(async (eventId: string | null) => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (eventId) params.set("eventId", eventId);
      const res = await fetch(`/api/admin/dashboard?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setData(json.data);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(readSavedEventId());
  }, [loadDashboard]);

  const role = user?.role;
  const showFinancials = canViewFinancialValues(role);

  useEffect(() => {
    if (!showFinancials) return;
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
  }, [pvPeriod, showFinancials]);

  const handleEventChange = (eventId: string) => {
    try {
      sessionStorage.setItem(EVENT_STORAGE_KEY, eventId);
    } catch {
      // sessionStorage indisponível: segue sem lembrar a seleção
    }
    loadDashboard(eventId);
  };

  const shortcuts = menuForRole(role).filter(
    (item) => item.shortcut && item.path !== "/checkin"
  );
  const canCheckin = menuForRole(role).some((item) => item.path === "/checkin");
  const isCheckinOnly = role === "CHECKIN";

  const { event, stats } = data ?? {};
  const eventSelector = (
    <Select
      value={data?.selectedEventId ?? undefined}
      onChange={handleEventChange}
      loading={loading}
      disabled={!data?.events.length}
      placeholder="Selecione o evento"
      style={{ width: "100%", maxWidth: 420 }}
      size="large"
      showSearch
      optionFilterProp="label"
      options={(data?.events ?? []).map((e) => ({
        value: e.id,
        label: `${e.title} (${dayjs(e.startDate).format("DD/MM/YYYY")})${
          e.isActive ? "" : " - inativo"
        }`,
      }))}
    />
  );

  return (
    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
      <div className="mb-4">
        <Title level={3} style={{ marginBottom: 4 }}>
          Dashboard
        </Title>
        {eventSelector}
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          message="Não foi possível carregar o dashboard"
          action={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => loadDashboard(data?.selectedEventId ?? null)}
            >
              Tentar novamente
            </Button>
          }
        />
      )}

      {/* Atalhos por perfil */}
      {!authLoading && canCheckin && (
        <Button
          type="primary"
          size="large"
          block
          icon={<QrcodeOutlined />}
          onClick={() => router.push("/checkin")}
          className="mb-4"
          style={{ height: isCheckinOnly ? 88 : 56, fontSize: isCheckinOnly ? 22 : 16 }}
        >
          Abrir check-in
        </Button>
      )}
      {!isCheckinOnly && (
        <Row gutter={[12, 12]} className="mb-4">
          {shortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Col key={item.path} xs={12} sm={8} md={6} lg={4}>
                <Card
                  size="small"
                  hoverable
                  className="text-center"
                  onClick={() => router.push(item.path)}
                >
                  <div className="text-xl mb-1">
                    <Icon />
                  </div>
                  <Text style={{ fontSize: 13, fontWeight: 500 }}>
                    {item.label}
                  </Text>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {loading && !data && <Skeleton active paragraph={{ rows: 6 }} />}

      {data && !data.event && (
        <Card>
          <Empty description="Nenhum evento cadastrado ainda" />
        </Card>
      )}

      {event && stats && (
        <Spin spinning={loading}>
          {!event.isActive && (
            <Alert
              type="warning"
              showIcon
              className="mb-4"
              message="Este evento está inativo"
            />
          )}

          <Row gutter={[12, 12]} className="mb-4">
            <Col xs={12} md={8} lg={6} xl={4}>
              <Card size="small">
                <Statistic
                  title="Inscritos"
                  value={stats.total}
                  prefix={<UserOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} md={8} lg={6} xl={4}>
              <Card size="small">
                <Statistic
                  title="Confirmados"
                  value={stats.confirmed}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: "#52c41a" }}
                />
              </Card>
            </Col>
            <Col xs={12} md={8} lg={6} xl={4}>
              <Card size="small">
                <Statistic
                  title="Pendentes"
                  value={stats.pending}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: "#fa8c16" }}
                />
              </Card>
            </Col>
            <Col xs={12} md={8} lg={6} xl={4}>
              <Card size="small">
                <Statistic
                  title="Vagas restantes"
                  value={stats.spotsLeft}
                  suffix={`/ ${event.maxParticipants}`}
                  prefix={<TeamOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} md={8} lg={6} xl={4}>
              <Card size="small">
                <Statistic
                  title="Check-ins"
                  value={stats.checkedIn}
                  suffix={`/ ${stats.confirmed}`}
                  prefix={<QrcodeOutlined />}
                  valueStyle={{ color: "#13c2c2" }}
                />
                <Progress
                  percent={
                    stats.confirmed > 0
                      ? Math.round((stats.checkedIn / stats.confirmed) * 100)
                      : 0
                  }
                  size="small"
                  showInfo={false}
                />
              </Card>
            </Col>
            {data?.financial && (
              <>
                <Col xs={12} md={8} lg={6} xl={4}>
                  <Card size="small">
                    <Statistic
                      title="Receita líquida"
                      value={formatBRL(data.financial.net)}
                      prefix={<DollarOutlined />}
                      valueStyle={{ color: "#52c41a", fontSize: 20 }}
                    />
                  </Card>
                </Col>
                <Col xs={12} md={8} lg={6} xl={4}>
                  <Link href="/admin/refund-requests">
                    <Card size="small" hoverable>
                      <Statistic
                        title="Estornos abertos"
                        value={data.financial.openRefunds}
                        prefix={<RollbackOutlined />}
                        valueStyle={{
                          color:
                            data.financial.openRefunds > 0
                              ? "#ff4d4f"
                              : undefined,
                        }}
                      />
                    </Card>
                  </Link>
                </Col>
              </>
            )}
          </Row>

          <Row gutter={[12, 12]} className="mb-4">
            {(event.hasShirt || (data?.shirtsBySize?.length ?? 0) > 0) && (
              <Col xs={24} lg={isCheckinOnly ? 24 : 10}>
                <Card size="small" title="Camisas confirmadas por tamanho">
                  {data?.shirtsBySize?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {data.shirtsBySize.map((s) => (
                        <Tag
                          key={s.size}
                          color="blue"
                          style={{ fontSize: 15, padding: "4px 10px" }}
                        >
                          {s.size}: <strong>{s.count}</strong>
                        </Tag>
                      ))}
                    </div>
                  ) : (
                    <Text type="secondary">Nenhuma camisa confirmada</Text>
                  )}
                </Card>
              </Col>
            )}
            {!isCheckinOnly && (
              <Col xs={24} lg={14}>
                <Card size="small" title="Últimas inscrições">
                  <List
                    size="small"
                    dataSource={data?.recentRegistrations ?? []}
                    locale={{ emptyText: "Nenhuma inscrição neste evento" }}
                    renderItem={(r) => {
                      const cfg = STATUS_CONFIG[r.status] ?? {
                        color: "default",
                        label: r.status,
                      };
                      return (
                        <List.Item
                          extra={<Tag color={cfg.color}>{cfg.label}</Tag>}
                        >
                          <List.Item.Meta
                            title={r.name}
                            description={dayjs(r.createdAt).format(
                              "DD/MM/YYYY HH:mm"
                            )}
                          />
                        </List.Item>
                      );
                    }}
                  />
                </Card>
              </Col>
            )}
          </Row>
        </Spin>
      )}

      {/* Visualizações de página (só quem vê valores) */}
      {showFinancials && (
        <Row gutter={[12, 12]} className="mb-6">
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
                        style={{
                          fontSize: 12,
                          fontWeight: index === 0 ? 600 : 400,
                        }}
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
      )}
    </div>
  );
}
