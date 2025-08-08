"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Input,
  Button,
  Table,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  message,
  Select,
  Popconfirm,
  Badge,
  Alert,
  Modal,
} from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CheckOutlined,
  UserOutlined,
  QrcodeOutlined,
  PrinterOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import AdminHeader from "../../components/admin/AdminHeader";
import CheckinReportPrint from "../../components/CheckinReportPrint";

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

interface Registration {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  checkedInAt?: string;
  createdAt: string;
  event: {
    id: string;
    title: string;
    price: number;
    startDate: string;
  };
}

interface Event {
  id: string;
  title: string;
  startDate: string;
  isActive: boolean;
}

interface ExportData {
  event: {
    id: string;
    title: string;
    description?: string;
    price: number;
    startDate: string;
    endDate?: string;
    location?: string;
  };
  registrations: Registration[];
  stats: {
    total: number;
    checkedIn: number;
    pending: number;
    totalRevenue: number;
    checkinRate: number;
  };
  exportedAt: string;
}

export default function CheckinPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string>(""); // Iniciar vazio para forçar seleção
  const [searchText, setSearchText] = useState("");
  const [searchInput, setSearchInput] = useState(""); // input do usuário
  const [isExporting, setIsExporting] = useState(false);
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) =>
      `${range[0]}-${range[1]} de ${total} participantes`,
  });
  const [stats, setStats] = useState({
    total: 0,
    checkedIn: 0,
    confirmed: 0,
    pending: 0,
    totalRevenue: 0,
  });

  // Buscar eventos
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

  // Buscar estatísticas
  const fetchStats = useCallback(async () => {
    if (!selectedEvent) return; // Não buscar se não tiver evento selecionado

    try {
      const params = new URLSearchParams({
        status: "CONFIRMED", // Apenas confirmados para check-in
        eventId: selectedEvent,
      });

      const response = await fetch(`/api/registrations/stats?${params}`);
      const data = await response.json();

      if (data.success) {
        // Buscar todas as inscrições confirmadas do evento para contar check-ins
        const allRegistrationsParams = new URLSearchParams({
          eventId: selectedEvent,
          status: "CONFIRMED",
          limit: "1000", // Buscar um número alto para pegar todas
        });

        const allRegistrationsResponse = await fetch(
          `/api/registrations?${allRegistrationsParams}`
        );
        const allRegistrationsData = await allRegistrationsResponse.json();

        let checkedInCount = 0;
        if (allRegistrationsData.success) {
          checkedInCount = allRegistrationsData.data.items.filter(
            (reg: Registration) => reg.checkedInAt
          ).length;
        }

        setStats({
          ...data.data,
          checkedIn: checkedInCount,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, [selectedEvent]);

  // Buscar inscrições confirmadas
  const fetchRegistrations = useCallback(
    async (page = 1, pageSize = 20) => {
      if (!selectedEvent) {
        setRegistrations([]);
        setPagination((prev) => ({ ...prev, total: 0 }));
        return; // Não buscar se não tiver evento selecionado
      }

      setLoading(true);
      try {
        // Construir parâmetros da query
        const params = new URLSearchParams({
          page: page.toString(),
          limit: pageSize.toString(),
          status: "CONFIRMED", // Apenas inscrições confirmadas para check-in
          eventId: selectedEvent,
        });

        if (searchText.trim()) {
          params.append("search", searchText.trim());
        }

        const response = await fetch(`/api/registrations?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
          const registrationsList = data.data.items || [];
          setRegistrations(registrationsList);

          // Atualizar paginação
          setPagination((prev) => ({
            ...prev,
            current: data.data.pagination.page,
            total: data.data.pagination.total,
            pageSize: data.data.pagination.limit,
          }));
        } else {
          message.error("Erro ao carregar inscrições");
        }
      } catch (error) {
        message.error("Erro ao carregar inscrições");
        console.error("Error fetching registrations:", error);
      } finally {
        setLoading(false);
      }
    },
    [selectedEvent, searchText]
  );

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (selectedEvent) {
      fetchRegistrations(1, 20); // página inicial
      fetchStats(); // buscar estatísticas
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce para o search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchText(searchInput);
    }, 500); // 500ms de delay

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Quando filtros mudam, buscar nova página e estatísticas
  useEffect(() => {
    if (selectedEvent) {
      fetchRegistrations(1, pagination.pageSize);
      fetchStats();
    }
  }, [
    selectedEvent,
    searchText,
    fetchRegistrations,
    fetchStats,
    pagination.pageSize,
  ]);

  // Função para lidar com mudanças na paginação da tabela
  const handleTableChange = (pag: { current?: number; pageSize?: number }) => {
    if (pag.current && pag.pageSize) {
      fetchRegistrations(pag.current, pag.pageSize);
    }
  };

  // Função para fazer check-in
  const handleCheckin = async (
    registrationId: string,
    participantName: string
  ) => {
    try {
      const response = await fetch(`/api/checkin/${registrationId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        message.success(`Check-in realizado para ${participantName}!`);
        fetchRegistrations(pagination.current, pagination.pageSize); // Recarregar página atual
        fetchStats(); // Atualizar estatísticas
      } else {
        message.error(data.error || "Erro ao fazer check-in");
      }
    } catch (error) {
      message.error("Erro ao fazer check-in");
      console.error("Error doing checkin:", error);
    }
  };

  // Função para desfazer check-in
  const handleUndoCheckin = async (
    registrationId: string,
    participantName: string
  ) => {
    try {
      const response = await fetch(`/api/checkin/${registrationId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        message.success(`Check-in desfeito para ${participantName}!`);
        fetchRegistrations(pagination.current, pagination.pageSize); // Recarregar página atual
        fetchStats(); // Atualizar estatísticas
      } else {
        message.error(data.error || "Erro ao desfazer check-in");
      }
    } catch (error) {
      message.error("Erro ao desfazer check-in");
      console.error("Error undoing checkin:", error);
    }
  };

  // Busca rápida por CPF
  const handleQuickSearch = async (value: string) => {
    setSearchInput(value);
    if (!value.trim()) {
      setSearchText("");
      return;
    }
  };

  // Função para exportar dados para impressão
  const handleExportForPrint = async () => {
    if (!selectedEvent) {
      message.error("Selecione um evento primeiro");
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/registrations/export?eventId=${selectedEvent}`
      );
      const data = await response.json();

      if (data.success) {
        setExportData(data.data);
        setShowPrintModal(true);
      } else {
        message.error(data.error || "Erro ao exportar dados");
      }
    } catch (error) {
      console.error("Error exporting data:", error);
      message.error("Erro ao exportar dados");
    } finally {
      setIsExporting(false);
    }
  };

  // Função para imprimir
  const handlePrint = () => {
    if (!exportData) return;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Relatório de Check-in - ${exportData.event.title}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; background: white; }
            .print-container { max-width: 100%; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
            .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
            .stat-card { border: 1px solid #ddd; padding: 15px; text-align: center; }
            .present { background-color: #f6ffed; color: #52c41a; font-weight: bold; }
            .waiting { color: #faad14; }
            .footer { margin-top: 30px; border-top: 2px solid #000; padding-top: 20px; display: flex; justify-content: space-between; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
              table { page-break-inside: avoid; }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="header">
              <h1>RELATÓRIO DE CHECK-IN</h1>
              <h2>${exportData.event.title}</h2>
              ${
                exportData.event.location
                  ? `<p>Local: ${exportData.event.location}</p>`
                  : ""
              }
              <p>Data do Evento: ${dayjs(exportData.event.startDate).format(
                "DD/MM/YYYY HH:mm"
              )}</p>
              <p style="font-size: 12px; color: #999; margin-top: 10px;">
                Relatório gerado em: ${dayjs(exportData.exportedAt).format(
                  "DD/MM/YYYY HH:mm"
                )}
              </p>
            </div>

            <div class="stats">
              <div class="stat-card">
                <h3>Total Confirmados</h3>
                <p style="font-size: 24px; font-weight: bold;">${
                  exportData.stats.total
                }</p>
              </div>
              <div class="stat-card">
                <h3>Check-ins Realizados</h3>
                <p style="font-size: 24px; font-weight: bold; color: #52c41a;">${
                  exportData.stats.checkedIn
                }</p>
              </div>
              <div class="stat-card">
                <h3>Aguardando Check-in</h3>
                <p style="font-size: 24px; font-weight: bold; color: #faad14;">${
                  exportData.stats.pending
                }</p>
              </div>
              <div class="stat-card">
                <h3>Taxa de Presença</h3>
                <p style="font-size: 24px; font-weight: bold;">${
                  exportData.stats.checkinRate
                }%</p>
              </div>
            </div>

            <h3 style="margin: 20px 0 10px 0;">Lista de Participantes (${
              exportData.registrations.length
            })</h3>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>CPF</th>
                  <th>Telefone</th>
                  <th>Status Check-in</th>
                  <th>Data Check-in</th>
                  <th>Assinatura</th>
                </tr>
              </thead>
              <tbody>
                ${exportData.registrations
                  .map(
                    (reg, index) => `
                  <tr class="${reg.checkedInAt ? "present" : ""}">
                    <td style="text-align: center;">${index + 1}</td>
                    <td style="font-weight: 500;">${reg.name}</td>
                    <td>${reg.email}</td>
                    <td>${reg.cpf.replace(
                      /(\d{3})(\d{3})(\d{3})(\d{2})/,
                      "$1.$2.$3-$4"
                    )}</td>
                    <td>${reg.phone || "-"}</td>
                    <td style="text-align: center;" class="${
                      reg.checkedInAt ? "present" : "waiting"
                    }">
                      ${reg.checkedInAt ? "✓ PRESENTE" : "⏱ AGUARDANDO"}
                    </td>
                    <td style="text-align: center;">
                      ${
                        reg.checkedInAt
                          ? dayjs(reg.checkedInAt).format("DD/MM HH:mm")
                          : "-"
                      }
                    </td>
                    <td style="height: 30px;"></td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>

            <div class="footer">
              <div>
                <p style="font-size: 12px; color: #666;">
                  Receita Total: R$ ${exportData.stats.totalRevenue.toLocaleString(
                    "pt-BR",
                    { minimumFractionDigits: 2 }
                  )}
                </p>
              </div>
              <div>
                <p style="font-size: 12px; color: #666; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 5px;">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                </p>
                <p style="font-size: 12px; color: #666; text-align: center;">Responsável pelo Evento</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `);

      printWindow.document.close();

      // Aguardar um pouco para garantir que o conteúdo foi carregado
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  // Função para exportar para CSV/Excel
  const handleExportToCSV = () => {
    if (!exportData) return;

    const csvData = [
      // Cabeçalho
      [
        "#",
        "Nome",
        "Email",
        "CPF",
        "Telefone",
        "Status Check-in",
        "Data Check-in",
        "Data Inscrição",
      ],
      // Dados
      ...exportData.registrations.map((reg, index) => [
        index + 1,
        reg.name,
        reg.email,
        reg.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
        reg.phone || "-",
        reg.checkedInAt ? "PRESENTE" : "AGUARDANDO",
        reg.checkedInAt
          ? dayjs(reg.checkedInAt).format("DD/MM/YYYY HH:mm")
          : "-",
        dayjs(reg.createdAt).format("DD/MM/YYYY HH:mm"),
      ]),
    ];

    const csvContent = csvData
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `checkin-${exportData.event.title.replace(
          /[^a-zA-Z0-9]/g,
          "_"
        )}-${dayjs().format("YYYY-MM-DD")}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      message.success("Arquivo CSV baixado com sucesso!");
    }
  };

  // Colunas da tabela
  const columns: ColumnsType<Registration> = [
    {
      title: "Participante",
      key: "participant",
      render: (_, record) => (
        <div>
          <div className="font-medium text-lg">{record.name}</div>
          <div className="text-sm text-gray-500">{record.email}</div>
          <div className="text-sm text-gray-500">
            CPF:{" "}
            {record.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
          </div>
          {/* Status visual integrado */}
          <div className="mt-1">
            {record.checkedInAt ? (
              <Badge
                status="success"
                text={
                  <span className="text-green-600 text-xs font-medium">
                    <CheckCircleOutlined /> Check-in:{" "}
                    {dayjs(record.checkedInAt).format("DD/MM HH:mm")}
                  </span>
                }
              />
            ) : (
              <Badge
                status="default"
                text={
                  <span className="text-gray-500 text-xs">
                    <ClockCircleOutlined /> Aguardando check-in
                  </span>
                }
              />
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Ações",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_, record) => (
        <div className="text-center">
          {!record.checkedInAt ? (
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => handleCheckin(record.id, record.name)}
              size="small"
              className="w-full"
            >
              Check-in
            </Button>
          ) : (
            <Popconfirm
              title="Desfazer check-in?"
              description="Tem certeza que deseja desfazer o check-in deste participante?"
              onConfirm={() => handleUndoCheckin(record.id, record.name)}
              okText="Sim"
              cancelText="Não"
            >
              <Button type="default" danger size="small" className="w-full">
                Desfazer
              </Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Title level={2}>
            <QrcodeOutlined className="mr-3" />
            Sistema de Check-in
          </Title>
          <Text type="secondary">Controle de presença dos participantes</Text>
          {selectedEvent && selectedEvent !== "ALL" && (
            <div className="mt-4">
              <Alert
                message={`Evento Selecionado: ${
                  events.find((e) => e.id === selectedEvent)?.title ||
                  "Carregando..."
                }`}
                type="info"
                showIcon
                className="mb-4"
              />
            </div>
          )}
        </div>

        {!selectedEvent ? (
          <Card className="mb-6">
            <Alert
              message="Selecione um Evento"
              description="Para começar a fazer check-ins, primeiro selecione um evento na seção abaixo."
              type="warning"
              showIcon
              className="mb-4"
            />
          </Card>
        ) : (
          <>
            {/* Estatísticas */}
            <Row gutter={[16, 16]} className="mb-6">
              <Col xs={12} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Total Confirmados"
                    value={stats.confirmed}
                    prefix={<UserOutlined />}
                    valueStyle={{ color: "#1890ff" }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Check-ins Realizados"
                    value={stats.checkedIn}
                    prefix={<CheckOutlined style={{ color: "#52c41a" }} />}
                    valueStyle={{ color: "#52c41a" }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Aguardando Check-in"
                    value={stats.confirmed - stats.checkedIn}
                    prefix={
                      <ClockCircleOutlined style={{ color: "#faad14" }} />
                    }
                    valueStyle={{ color: "#faad14" }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Taxa de Presença"
                    value={
                      stats.confirmed > 0
                        ? Math.round((stats.checkedIn / stats.confirmed) * 100)
                        : 0
                    }
                    suffix="%"
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{
                      color:
                        stats.confirmed > 0 &&
                        stats.checkedIn / stats.confirmed >= 0.8
                          ? "#52c41a"
                          : "#faad14",
                    }}
                  />
                </Card>
              </Col>
            </Row>
          </>
        )}

        {/* Seleção de Evento e Busca */}
        <Card className="mb-6">
          <Alert
            message="Seleção de Evento"
            description="Primeiro selecione o evento para visualizar os participantes confirmados"
            type="info"
            showIcon
            className="mb-4"
          />

          <Row gutter={[16, 16]} align="middle" className="mb-4">
            <Col xs={24} sm={24} md={8} lg={6}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Evento *
              </label>
              <Select
                placeholder="Selecione um evento"
                value={selectedEvent || undefined}
                onChange={setSelectedEvent}
                style={{ width: "100%" }}
                size="large"
                status={!selectedEvent ? "error" : undefined}
              >
                {events.map((event) => (
                  <Option key={event.id} value={event.id}>
                    {event.title}
                  </Option>
                ))}
              </Select>
            </Col>
            {selectedEvent && (
              <Col xs={24} sm={24} md={16} lg={18}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Busca Rápida
                </label>
                <Search
                  placeholder="Digite nome, email ou CPF para busca rápida..."
                  allowClear
                  enterButton="Buscar"
                  size="large"
                  value={searchInput}
                  onSearch={handleQuickSearch}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchInput(value);
                    if (!value) {
                      setSearchText("");
                    }
                  }}
                />
              </Col>
            )}
          </Row>
        </Card>

        {/* Lista de Participantes */}
        {selectedEvent && (
          <Card>
            <div className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <Title level={4} className="mb-0">
                Participantes Confirmados
              </Title>
              <Space className="flex-wrap">
                <Button
                  onClick={() =>
                    fetchRegistrations(pagination.current, pagination.pageSize)
                  }
                  size="large"
                >
                  Atualizar Lista
                </Button>
                <Button
                  type="primary"
                  icon={<PrinterOutlined />}
                  onClick={handleExportForPrint}
                  loading={isExporting}
                  size="large"
                >
                  Imprimir Lista
                </Button>
                <Badge count={pagination.total} showZero color="#1890ff" />
              </Space>
            </div>

            <div className="overflow-x-auto">
              <Table
                columns={columns}
                dataSource={registrations}
                rowKey="id"
                loading={loading}
                pagination={pagination}
                onChange={handleTableChange}
                rowClassName={(record) =>
                  record.checkedInAt ? "bg-green-50" : ""
                }
                scroll={{ x: "max-content" }}
                size="middle"
              />
            </div>
          </Card>
        )}

        {/* Modal de Impressão */}
        <Modal
          title="Relatório de Check-in"
          open={showPrintModal}
          onCancel={() => setShowPrintModal(false)}
          width="90%"
          style={{ top: 20 }}
          footer={[
            <Button
              key="csv"
              icon={<FileExcelOutlined />}
              onClick={handleExportToCSV}
            >
              Exportar CSV
            </Button>,
            <Button key="cancel" onClick={() => setShowPrintModal(false)}>
              Cancelar
            </Button>,
            <Button
              key="print"
              type="primary"
              icon={<PrinterOutlined />}
              onClick={handlePrint}
            >
              Imprimir
            </Button>,
          ]}
        >
          {exportData && <CheckinReportPrint data={exportData} />}
        </Modal>
      </div>
    </div>
  );
}
