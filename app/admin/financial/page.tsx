"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Typography,
  Row,
  Col,
  Statistic,
  Table,
  DatePicker,
  Select,
  Divider,
  Progress,
  Tag,
} from "antd";
import {
  DollarOutlined,
  TrophyOutlined,
  UserOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface FinancialData {
  totalRevenue: number;
  confirmedRevenue: number;
  pendingRevenue: number;
  totalRegistrations: number;
  confirmedRegistrations: number;
  pendingRegistrations: number;
  cancelledRegistrations: number;
  eventBreakdown: EventFinancialData[];
  dailyRevenue: DailyRevenueData[];
}

interface EventFinancialData {
  eventId: string;
  eventTitle: string;
  eventPrice: number;
  eventDate: string;
  totalRegistrations: number;
  confirmedRegistrations: number;
  pendingRegistrations: number;
  cancelledRegistrations: number;
  totalRevenue: number;
  confirmedRevenue: number;
  pendingRevenue: number;
}

interface DailyRevenueData {
  date: string;
  revenue: number;
  registrations: number;
}

export default function FinancialPage() {
  const [financialData, setFinancialData] = useState<FinancialData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(
    null
  );
  const [selectedEvent, setSelectedEvent] = useState<string>("ALL");
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);

  // Buscar dados financeiros
  const fetchFinancialData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (dateRange) {
        params.set("startDate", dateRange[0].toISOString());
        params.set("endDate", dateRange[1].toISOString());
      }

      if (selectedEvent !== "ALL") {
        params.set("eventId", selectedEvent);
      }

      const response = await fetch(`/api/admin/financial?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setFinancialData(data.data);
      }
    } catch (error) {
      console.error("Erro ao buscar dados financeiros:", error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedEvent]);

  // Buscar eventos para filtro
  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch("/api/events");
      const data = await response.json();

      if (data.success) {
        setEvents(data.data.items || []);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
    }
  }, []);

  useEffect(() => {
    fetchFinancialData();
    fetchEvents();
  }, [fetchFinancialData, fetchEvents]);

  // Colunas da tabela de eventos
  const eventColumns: ColumnsType<EventFinancialData> = [
    {
      title: "Evento",
      dataIndex: "eventTitle",
      key: "eventTitle",
      render: (text, record) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-sm text-gray-500">
            {dayjs(record.eventDate).format("DD/MM/YYYY")} - R${" "}
            {record.eventPrice.toFixed(2)}
          </div>
        </div>
      ),
    },
    {
      title: "Inscrições",
      key: "registrations",
      render: (_, record) => (
        <div className="text-center">
          <div className="font-semibold text-lg">
            {record.totalRegistrations}
          </div>
          <div className="flex justify-center space-x-2 mt-1">
            <Tag color="green" className="text-xs">
              <CheckCircleOutlined /> {record.confirmedRegistrations}
            </Tag>
            <Tag color="orange" className="text-xs">
              <ClockCircleOutlined /> {record.pendingRegistrations}
            </Tag>
            {record.cancelledRegistrations > 0 && (
              <Tag color="red" className="text-xs">
                ✕ {record.cancelledRegistrations}
              </Tag>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Receita Total",
      dataIndex: "totalRevenue",
      key: "totalRevenue",
      render: (value) => (
        <div className="text-center">
          <div className="font-semibold text-lg text-blue-600">
            R$ {value.toFixed(2)}
          </div>
        </div>
      ),
      sorter: (a, b) => a.totalRevenue - b.totalRevenue,
    },
    {
      title: "Receita Confirmada",
      dataIndex: "confirmedRevenue",
      key: "confirmedRevenue",
      render: (value) => (
        <div className="text-center">
          <div className="font-semibold text-lg text-green-600">
            R$ {value.toFixed(2)}
          </div>
        </div>
      ),
      sorter: (a, b) => a.confirmedRevenue - b.confirmedRevenue,
    },
    {
      title: "Taxa de Confirmação",
      key: "confirmationRate",
      render: (_, record) => {
        const rate =
          record.totalRegistrations > 0
            ? (record.confirmedRegistrations / record.totalRegistrations) * 100
            : 0;
        return (
          <div className="text-center">
            <Progress
              type="circle"
              size={50}
              percent={Math.round(rate)}
              format={(percent) => `${percent}%`}
              strokeColor={
                rate >= 80 ? "#52c41a" : rate >= 60 ? "#faad14" : "#ff4d4f"
              }
            />
          </div>
        );
      },
    },
  ];

  if (!financialData) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-8">
          <div className="text-lg">Carregando dados financeiros...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Title level={2}>
          <BarChartOutlined className="mr-3" />
          Resumo Financeiro
        </Title>
        <Text type="secondary">
          Acompanhe o desempenho financeiro dos seus eventos
        </Text>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <Row gutter={16} align="middle">
          <Col>
            <Text strong>Filtrar por:</Text>
          </Col>
          <Col>
            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange([dates[0], dates[1]]);
                } else {
                  setDateRange(null);
                }
              }}
              format="DD/MM/YYYY"
              placeholder={["Data início", "Data fim"]}
            />
          </Col>
          <Col>
            <Select
              value={selectedEvent}
              onChange={setSelectedEvent}
              style={{ width: 200 }}
              placeholder="Selecionar evento"
            >
              <Option value="ALL">Todos os Eventos</Option>
              {events.map((event) => (
                <Option key={event.id} value={event.id}>
                  {event.title}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      {/* Estatísticas Gerais */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="Receita Total"
              value={financialData.totalRevenue}
              precision={2}
              prefix={<DollarOutlined style={{ color: "#1890ff" }} />}
              suffix="R$"
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Receita Confirmada"
              value={financialData.confirmedRevenue}
              precision={2}
              prefix={<TrophyOutlined style={{ color: "#52c41a" }} />}
              suffix="R$"
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total de Inscrições"
              value={financialData.totalRegistrations}
              prefix={<UserOutlined style={{ color: "#722ed1" }} />}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Inscrições Confirmadas"
              value={financialData.confirmedRegistrations}
              prefix={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Status das Inscrições */}
      <Row gutter={16} className="mb-6">
        <Col span={12}>
          <Card title="Status das Inscrições" className="h-full">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Confirmadas</span>
                <div className="flex items-center space-x-2">
                  <Progress
                    percent={Math.round(
                      (financialData.confirmedRegistrations /
                        financialData.totalRegistrations) *
                        100
                    )}
                    showInfo={false}
                    strokeColor="#52c41a"
                    className="w-24"
                  />
                  <span className="font-semibold">
                    {financialData.confirmedRegistrations}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Pendentes</span>
                <div className="flex items-center space-x-2">
                  <Progress
                    percent={Math.round(
                      (financialData.pendingRegistrations /
                        financialData.totalRegistrations) *
                        100
                    )}
                    showInfo={false}
                    strokeColor="#faad14"
                    className="w-24"
                  />
                  <span className="font-semibold">
                    {financialData.pendingRegistrations}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Canceladas</span>
                <div className="flex items-center space-x-2">
                  <Progress
                    percent={Math.round(
                      (financialData.cancelledRegistrations /
                        financialData.totalRegistrations) *
                        100
                    )}
                    showInfo={false}
                    strokeColor="#ff4d4f"
                    className="w-24"
                  />
                  <span className="font-semibold">
                    {financialData.cancelledRegistrations}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Resumo de Receita" className="h-full">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Receita Confirmada</span>
                <span className="font-semibold text-green-600">
                  R$ {financialData.confirmedRevenue.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Receita Pendente</span>
                <span className="font-semibold text-orange-500">
                  R$ {financialData.pendingRevenue.toFixed(2)}
                </span>
              </div>
              <Divider />
              <div className="flex justify-between items-center text-lg">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-blue-600">
                  R$ {financialData.totalRevenue.toFixed(2)}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                Taxa de confirmação:{" "}
                {Math.round(
                  (financialData.confirmedRevenue /
                    financialData.totalRevenue) *
                    100
                )}
                %
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Tabela de Eventos */}
      <Card title="Desempenho por Evento">
        <Table
          columns={eventColumns}
          dataSource={financialData.eventBreakdown}
          rowKey="eventId"
          loading={loading}
          pagination={false}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
}
