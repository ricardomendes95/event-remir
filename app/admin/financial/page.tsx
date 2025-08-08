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
  Button,
  message,
} from "antd";
import {
  DollarOutlined,
  TrophyOutlined,
  UserOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  CreditCardOutlined,
  EditOutlined,
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
  // Por método de pagamento
  mercadoPagoTotalRevenue: number;
  mercadoPagoConfirmedRevenue: number;
  mercadoPagoRegistrations: number;
  manualTotalRevenue: number;
  manualConfirmedRevenue: number;
  manualRegistrations: number;
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
  // Por método de pagamento
  mercadoPagoRegistrations: number;
  manualRegistrations: number;
  mercadoPagoConfirmedRegistrations: number;
  manualConfirmedRegistrations: number;
  mercadoPagoRevenue: number;
  manualRevenue: number;
  mercadoPagoConfirmedRevenue: number;
  manualConfirmedRevenue: number;
}

interface DailyRevenueData {
  date: string;
  revenue: number;
  registrations: number;
  mercadoPagoRevenue: number;
  manualRevenue: number;
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
  const [exportLoading, setExportLoading] = useState(false);

  // Função para exportar relatório
  const handleExportReport = useCallback(async () => {
    setExportLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("format", "export");

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
        // Criar dados para CSV
        const csvData = data.data.detailedRegistrations.map(
          (reg: {
            id: string;
            eventTitle: string;
            participantName: string;
            participantEmail: string;
            participantCPF: string;
            participantPhone: string;
            status: string;
            paymentMethod: string;
            eventPrice: number;
            registrationDate: string;
            eventDate: string;
          }) => ({
            ID: reg.id,
            Evento: reg.eventTitle,
            Participante: reg.participantName,
            Email: reg.participantEmail,
            CPF: reg.participantCPF,
            Telefone: reg.participantPhone,
            Status: reg.status,
            "Método de Pagamento":
              reg.paymentMethod === "MERCADO_PAGO" ? "Mercado Pago" : "Manual",
            "Valor do Evento": `R$ ${Number(reg.eventPrice).toFixed(2)}`,
            "Data da Inscrição": new Date(
              reg.registrationDate
            ).toLocaleDateString("pt-BR"),
            "Data do Evento": new Date(reg.eventDate).toLocaleDateString(
              "pt-BR"
            ),
          })
        );

        // Converter para CSV
        const csvContent = convertToCSV(csvData);
        downloadCSV(
          csvContent,
          `relatorio-financeiro-${new Date().toISOString().split("T")[0]}.csv`
        );

        message.success("Relatório exportado com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao exportar relatório:", error);
      message.error("Erro ao exportar relatório");
    } finally {
      setExportLoading(false);
    }
  }, [dateRange, selectedEvent]);

  // Função auxiliar para converter dados para CSV
  const convertToCSV = (data: Record<string, string | number>[]) => {
    if (data.length === 0) return "";

    const headers = Object.keys(data[0]);
    // Adicionar BOM (Byte Order Mark) para UTF-8 e usar ponto e vírgula como separador para Excel brasileiro
    const BOM = "\uFEFF";
    const csvRows = [
      headers.join(";"),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            // Escapar aspas duplas e envolver em aspas se necessário
            const cellStr = String(value).replace(/"/g, '""');
            return `"${cellStr}"`;
          })
          .join(";")
      ),
    ];

    return BOM + csvRows.join("\r\n");
  };

  // Função auxiliar para fazer download do CSV
  const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      title: "Método de Pagamento",
      key: "paymentMethod",
      render: (_, record) => (
        <div className="text-center">
          <div className="space-y-1">
            <div className="flex justify-center items-center space-x-2">
              <CreditCardOutlined style={{ color: "#1890ff" }} />
              <span className="text-sm">
                MP: {record.mercadoPagoRegistrations}
              </span>
            </div>
            <div className="flex justify-center items-center space-x-2">
              <EditOutlined style={{ color: "#52c41a" }} />
              <span className="text-sm">
                Manual: {record.manualRegistrations}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Receita Total",
      dataIndex: "totalRevenue",
      key: "totalRevenue",
      render: (value, record) => (
        <div className="text-center">
          <div className="font-semibold text-lg text-blue-600">
            R$ {value.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            <div>MP: R$ {record.mercadoPagoRevenue.toFixed(2)}</div>
            <div>Manual: R$ {record.manualRevenue.toFixed(2)}</div>
          </div>
        </div>
      ),
      sorter: (a, b) => a.totalRevenue - b.totalRevenue,
    },
    {
      title: "Receita Confirmada",
      dataIndex: "confirmedRevenue",
      key: "confirmedRevenue",
      render: (value, record) => (
        <div className="text-center">
          <div className="font-semibold text-lg text-green-600">
            R$ {value.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            <div>MP: R$ {record.mercadoPagoConfirmedRevenue.toFixed(2)}</div>
            <div>Manual: R$ {record.manualConfirmedRevenue.toFixed(2)}</div>
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
        <Row gutter={16} align="middle" justify="space-between">
          <Col>
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
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExportReport}
              loading={exportLoading}
            >
              Exportar Relatório
            </Button>
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

      {/* Estatísticas por Método de Pagamento */}
      <Row gutter={16} className="mb-6">
        <Col span={12}>
          <Card
            title={
              <div className="flex items-center">
                <CreditCardOutlined
                  className="mr-2"
                  style={{ color: "#1890ff" }}
                />
                Mercado Pago
              </div>
            }
            className="h-full"
          >
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="Receita Total"
                  value={financialData.mercadoPagoTotalRevenue}
                  precision={2}
                  suffix="R$"
                  valueStyle={{ color: "#1890ff", fontSize: "18px" }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Receita Confirmada"
                  value={financialData.mercadoPagoConfirmedRevenue}
                  precision={2}
                  suffix="R$"
                  valueStyle={{ color: "#52c41a", fontSize: "18px" }}
                />
              </Col>
            </Row>
            <Divider />
            <div className="text-center">
              <span className="text-lg font-semibold text-gray-700">
                {financialData.mercadoPagoRegistrations} inscrições
              </span>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            title={
              <div className="flex items-center">
                <EditOutlined className="mr-2" style={{ color: "#52c41a" }} />
                Inscrições Manuais
              </div>
            }
            className="h-full"
          >
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="Receita Total"
                  value={financialData.manualTotalRevenue}
                  precision={2}
                  suffix="R$"
                  valueStyle={{ color: "#1890ff", fontSize: "18px" }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Receita Confirmada"
                  value={financialData.manualConfirmedRevenue}
                  precision={2}
                  suffix="R$"
                  valueStyle={{ color: "#52c41a", fontSize: "18px" }}
                />
              </Col>
            </Row>
            <Divider />
            <div className="text-center">
              <span className="text-lg font-semibold text-gray-700">
                {financialData.manualRegistrations} inscrições
              </span>
            </div>
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
