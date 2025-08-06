"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Input,
  Button,
  Table,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Statistic,
  message,
  Select,
  Popconfirm,
  Badge,
  Alert,
} from "antd";
import {
  SearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CheckOutlined,
  UserOutlined,
  QrcodeOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import AdminHeader from "../admin/components/AdminHeader";

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

export default function CheckinPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string>("ALL");
  const [stats, setStats] = useState({
    total: 0,
    checkedIn: 0,
    confirmed: 0,
    pending: 0,
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

  // Buscar inscrições confirmadas
  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", "CONFIRMED"); // Apenas inscrições confirmadas para check-in

      if (selectedEvent !== "ALL") {
        params.set("eventId", selectedEvent);
      }

      const response = await fetch(`/api/registrations?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        const registrationsList = data.data.items || [];
        setRegistrations(registrationsList);

        // Calcular estatísticas
        const total = registrationsList.length;
        const checkedIn = registrationsList.filter(
          (r: Registration) => r.checkedInAt
        ).length;
        const confirmed = registrationsList.filter(
          (r: Registration) => r.status === "CONFIRMED"
        ).length;
        const pending = registrationsList.filter(
          (r: Registration) => r.status === "PENDING"
        ).length;

        setStats({
          total,
          checkedIn,
          confirmed,
          pending,
        });
      } else {
        message.error("Erro ao carregar inscrições");
      }
    } catch (error) {
      message.error("Erro ao carregar inscrições");
      console.error("Error fetching registrations:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedEvent]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

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
        fetchRegistrations(); // Recarregar lista
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
        fetchRegistrations(); // Recarregar lista
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
    if (!value.trim()) {
      fetchRegistrations();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/checkin/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: value }),
      });

      const data = await response.json();

      if (data.success) {
        setRegistrations(data.data.items || []);
      } else {
        message.warning("Nenhuma inscrição encontrada");
        setRegistrations([]);
      }
    } catch (error) {
      message.error("Erro na busca");
      console.error("Error searching:", error);
    } finally {
      setLoading(false);
    }
  };

  // Colunas da tabela
  const columns: ColumnsType<Registration> = [
    {
      title: "Status Check-in",
      key: "checkinStatus",
      width: 120,
      render: (_, record) => (
        <div className="text-center">
          {record.checkedInAt ? (
            <Badge
              status="success"
              text={
                <span className="text-green-600 font-medium">
                  <CheckCircleOutlined /> Check-in feito
                </span>
              }
            />
          ) : (
            <Badge
              status="default"
              text={
                <span className="text-gray-500">
                  <ClockCircleOutlined /> Aguardando
                </span>
              }
            />
          )}
        </div>
      ),
    },
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
        </div>
      ),
    },
    {
      title: "Evento",
      dataIndex: "event",
      key: "event",
      render: (event) => (
        <div>
          <div className="font-medium">{event.title}</div>
          <div className="text-sm text-gray-500">
            {dayjs(event.startDate).format("DD/MM/YYYY HH:mm")}
          </div>
        </div>
      ),
    },
    {
      title: "Check-in",
      key: "checkinTime",
      render: (_, record) => (
        <div className="text-center">
          {record.checkedInAt ? (
            <div>
              <div className="text-green-600 font-medium">
                {dayjs(record.checkedInAt).format("DD/MM/YYYY")}
              </div>
              <div className="text-sm text-gray-500">
                {dayjs(record.checkedInAt).format("HH:mm")}
              </div>
            </div>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>
      ),
    },
    {
      title: "Ações",
      key: "actions",
      width: 150,
      render: (_, record) => (
        <Space>
          {!record.checkedInAt ? (
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => handleCheckin(record.id, record.name)}
              size="small"
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
              <Button type="default" danger size="small">
                Desfazer
              </Button>
            </Popconfirm>
          )}
        </Space>
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
          <Text type="secondary">
            Controle de presença dos participantes
          </Text>
        </div>
        {/* Estatísticas */}
        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Confirmados"
                value={stats.confirmed}
                prefix={<UserOutlined />}
                valueStyle={{ color: "#1890ff" }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Check-ins Realizados"
                value={stats.checkedIn}
                prefix={<CheckOutlined />}
                valueStyle={{ color: "#52c41a" }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Aguardando Check-in"
                value={stats.confirmed - stats.checkedIn}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: "#faad14" }}
              />
            </Card>
          </Col>
          <Col span={6}>
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

        {/* Busca Rápida */}
        <Card className="mb-6">
          <Alert
            message="Busca Rápida"
            description="Digite o nome, email ou CPF do participante para localizar rapidamente"
            type="info"
            showIcon
            className="mb-4"
          />

          <Row gutter={16} align="middle">
            <Col flex="auto">
              <Search
                placeholder="Digite nome, email ou CPF para busca rápida..."
                allowClear
                enterButton="Buscar"
                size="large"
                onSearch={handleQuickSearch}
                onChange={(e) => {
                  if (!e.target.value) {
                    fetchRegistrations();
                  }
                }}
              />
            </Col>
            <Col>
              <Select
                value={selectedEvent}
                onChange={setSelectedEvent}
                style={{ width: 200 }}
                size="large"
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

        {/* Lista de Participantes */}
        <Card>
          <div className="mb-4 flex justify-between items-center">
            <Title level={4} className="mb-0">
              Participantes Confirmados
            </Title>
            <Space>
              <Button
                onClick={fetchRegistrations}
                size="large"
              >
                Atualizar Lista
              </Button>
              <Badge count={registrations.length} showZero color="#1890ff" />
            </Space>
          </div>

          <Table
            columns={columns}
            dataSource={registrations}
            rowKey="id"
            loading={loading}
            pagination={{
              total: registrations.length,
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} de ${total} participantes`,
            }}
            rowClassName={(record) => (record.checkedInAt ? "bg-green-50" : "")}
            scroll={{ x: 800 }}
          />
        </Card>
      </div>
    </div>
  );
}
