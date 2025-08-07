"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Button,
  Table,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Tag,
  Typography,
  Row,
  Col,
  Statistic,
  Tooltip,
  Badge,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  UserAddOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { z } from "zod";
import AdminHeader from "../components/AdminHeader";

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

// Schema de validação para inscrição manual
const registrationSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  cpf: z.string().min(11, "CPF deve ter 11 dígitos").max(14, "CPF inválido"),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  eventId: z.string().min(1, "Evento é obrigatório"),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]).default("CONFIRMED"),
});

interface Registration {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
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
  price: number;
  startDate: string;
  isActive: boolean;
}

interface RegistrationFormData {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  eventId: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
}

export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRegistration, setEditingRegistration] =
    useState<Registration | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [eventFilter, setEventFilter] = useState<string>("ALL");
  const [stats, setStats] = useState({
    total: 0,
    confirmed: 0,
    pending: 0,
    cancelled: 0,
    totalRevenue: 0,
  });

  // Buscar inscrições
  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/registrations");
      const data = await response.json();

      if (data.success) {
        const registrationsList = data.data.items || [];
        setRegistrations(registrationsList);

        // Calcular estatísticas
        const confirmed = registrationsList.filter(
          (r: Registration) => r.status === "CONFIRMED"
        ).length;
        const pending = registrationsList.filter(
          (r: Registration) => r.status === "PENDING"
        ).length;
        const cancelled = registrationsList.filter(
          (r: Registration) => r.status === "CANCELLED"
        ).length;
        const totalRevenue = registrationsList
          .filter((r: Registration) => r.status === "CONFIRMED")
          .reduce((sum: number, r: Registration) => sum + r.event.price, 0);

        setStats({
          total: registrationsList.length,
          confirmed,
          pending,
          cancelled,
          totalRevenue,
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
  }, []);

  // Buscar eventos para o filtro e formulário
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
    fetchRegistrations();
    fetchEvents();
  }, [fetchRegistrations, fetchEvents]);

  // Filtrar inscrições
  const filteredRegistrations = registrations.filter((registration) => {
    const matchesSearch =
      registration.name.toLowerCase().includes(searchText.toLowerCase()) ||
      registration.email.toLowerCase().includes(searchText.toLowerCase()) ||
      registration.cpf.includes(searchText) ||
      registration.event.title.toLowerCase().includes(searchText.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || registration.status === statusFilter;
    const matchesEvent =
      eventFilter === "ALL" || registration.event.id === eventFilter;

    return matchesSearch && matchesStatus && matchesEvent;
  });

  // Função para formatar CPF
  const formatCPF = (value: string) => {
    const cpf = value.replace(/\D/g, "");
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  // Função para formatar telefone
  const formatPhone = (value: string) => {
    const phone = value.replace(/\D/g, "");
    if (phone.length <= 10) {
      return phone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };

  // Abrir modal para nova inscrição
  const handleNewRegistration = () => {
    setEditingRegistration(null);
    setIsModalVisible(true);
    form.resetFields();
  };

  // Abrir modal para edição
  const handleEditRegistration = (registration: Registration) => {
    setEditingRegistration(registration);
    setIsModalVisible(true);
    form.setFieldsValue({
      ...registration,
      cpf: formatCPF(registration.cpf),
      phone: formatPhone(registration.phone),
    });
  };

  // Salvar inscrição (criar ou editar)
  const handleSaveRegistration = async (values: RegistrationFormData) => {
    try {
      const cleanValues = {
        ...values,
        cpf: values.cpf.replace(/\D/g, ""),
        phone: values.phone.replace(/\D/g, ""),
      };

      // Validar com Zod
      registrationSchema.parse(cleanValues);

      const url = editingRegistration
        ? `/api/registrations/${editingRegistration.id}`
        : "/api/registrations";

      const method = editingRegistration ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanValues),
      });

      const data = await response.json();

      if (data.success) {
        message.success(
          editingRegistration ? "Inscrição atualizada!" : "Inscrição criada!"
        );
        setIsModalVisible(false);
        fetchRegistrations();
      } else {
        message.error(data.error || "Erro ao salvar inscrição");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.issues.forEach((issue) => {
          message.error(issue.message);
        });
      } else {
        message.error("Erro ao salvar inscrição");
      }
    }
  };

  // Excluir inscrição
  const handleDeleteRegistration = async (registrationId: string) => {
    try {
      const response = await fetch(`/api/registrations/${registrationId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        message.success("Inscrição excluída!");
        fetchRegistrations();
      } else {
        message.error(data.error || "Erro ao excluir inscrição");
      }
    } catch (error: unknown) {
      console.error("Error deleting registration:", error);
      message.error("Erro ao excluir inscrição");
    }
  };

  // Alterar status da inscrição
  const handleChangeStatus = async (
    registrationId: string,
    newStatus: string
  ) => {
    try {
      const response = await fetch(`/api/registrations/${registrationId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (data.success) {
        message.success("Status atualizado!");
        fetchRegistrations();
      } else {
        message.error(data.error || "Erro ao atualizar status");
      }
    } catch (error: unknown) {
      console.error("Error changing status:", error);
      message.error("Erro ao atualizar status");
    }
  };

  // Colunas da tabela
  const columns: ColumnsType<Registration> = [
    {
      title: "Participante",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text, record) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-sm text-gray-500">{record.email}</div>
        </div>
      ),
    },
    {
      title: "CPF",
      dataIndex: "cpf",
      key: "cpf",
      render: (text) => formatCPF(text),
    },
    {
      title: "Telefone",
      dataIndex: "phone",
      key: "phone",
      render: (text) => formatPhone(text),
    },
    {
      title: "Evento",
      dataIndex: "event",
      key: "event",
      render: (event) => (
        <div>
          <div className="font-medium">{event.title}</div>
          <div className="text-sm text-gray-500">
            R$ {event.price.toFixed(2)}
          </div>
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      filters: [
        { text: "Confirmado", value: "CONFIRMED" },
        { text: "Pendente", value: "PENDING" },
        { text: "Cancelado", value: "CANCELLED" },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: "PENDING" | "CONFIRMED" | "CANCELLED") => {
        const statusConfig: Record<
          string,
          { color: string; icon: React.ReactNode; text: string }
        > = {
          CONFIRMED: {
            color: "green",
            icon: <CheckCircleOutlined />,
            text: "Confirmado",
          },
          PENDING: {
            color: "orange",
            icon: <ClockCircleOutlined />,
            text: "Pendente",
          },
          CANCELLED: {
            color: "red",
            icon: <CloseCircleOutlined />,
            text: "Cancelado",
          },
        };

        const config = statusConfig[status];

        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: "Data de Inscrição",
      dataIndex: "createdAt",
      key: "createdAt",
      sorter: (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      render: (date) => dayjs(date).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "Ações",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="Editar">
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEditRegistration(record)}
            />
          </Tooltip>

          <Tooltip title="Alterar Status">
            <Select
              size="small"
              value={record.status}
              style={{ width: 100 }}
              onChange={(value) => handleChangeStatus(record.id, value)}
            >
              <Option value="CONFIRMED">
                <Tag color="green" className="m-0">
                  Confirmado
                </Tag>
              </Option>
              <Option value="PENDING">
                <Tag color="orange" className="m-0">
                  Pendente
                </Tag>
              </Option>
              <Option value="CANCELLED">
                <Tag color="red" className="m-0">
                  Cancelado
                </Tag>
              </Option>
            </Select>
          </Tooltip>

          <Popconfirm
            title="Tem certeza que deseja excluir esta inscrição?"
            onConfirm={() => handleDeleteRegistration(record.id)}
            okText="Sim"
            cancelText="Não"
          >
            <Tooltip title="Excluir">
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Tooltip>
          </Popconfirm>
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
            <UserAddOutlined className="mr-3" />
            Gestão de Inscrições
          </Title>
          <Text type="secondary">Gerencie todas as inscrições dos eventos</Text>
        </div>

        {/* Estatísticas */}
        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <Card>
              <Statistic
                title="Total de Inscrições"
                value={stats.total}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Confirmadas"
                value={stats.confirmed}
                prefix={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
                valueStyle={{ color: "#52c41a" }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Pendentes"
                value={stats.pending}
                prefix={<ClockCircleOutlined style={{ color: "#faad14" }} />}
                valueStyle={{ color: "#faad14" }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Receita Total"
                value={stats.totalRevenue}
                precision={2}
                prefix="R$"
                valueStyle={{ color: "#1890ff" }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filtros e Busca */}
        <Card className="mb-6">
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <Search
                placeholder="Buscar por nome, email, CPF ou evento..."
                allowClear
                size="large"
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: "100%" }}
              />
            </Col>
            <Col>
              <Select
                placeholder="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 120 }}
                size="large"
              >
                <Option value="ALL">Todos</Option>
                <Option value="CONFIRMED">Confirmado</Option>
                <Option value="PENDING">Pendente</Option>
                <Option value="CANCELLED">Cancelado</Option>
              </Select>
            </Col>
            <Col>
              <Select
                placeholder="Evento"
                value={eventFilter}
                onChange={setEventFilter}
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
            <Col>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchRegistrations}
                size="large"
              >
                Atualizar
              </Button>
            </Col>
          </Row>
        </Card>

        {/* Tabela */}
        <Card>
          <div className="mb-4 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Title level={4} className="mb-0">
                Lista de Inscrições
              </Title>
              <Badge
                count={filteredRegistrations.length}
                showZero
                color="#1890ff"
              />
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleNewRegistration}
              size="large"
            >
              Nova Inscrição Manual
            </Button>
          </div>

          <Table
            columns={columns}
            dataSource={filteredRegistrations}
            rowKey="id"
            loading={loading}
            pagination={{
              total: filteredRegistrations.length,
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} de ${total} inscrições`,
            }}
            scroll={{ x: 800 }}
          />
        </Card>

        {/* Modal de Criar/Editar Inscrição */}
        <Modal
          title={
            editingRegistration ? "Editar Inscrição" : "Nova Inscrição Manual"
          }
          open={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          footer={null}
          width={600}
          destroyOnHidden
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSaveRegistration}
            className="mt-4"
          >
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  name="eventId"
                  label="Evento"
                  rules={[{ required: true, message: "Evento é obrigatório" }]}
                >
                  <Select placeholder="Selecione o evento" size="large">
                    {events
                      .filter((event) => event.isActive)
                      .map((event) => (
                        <Option key={event.id} value={event.id}>
                          {event.title} - R$ {event.price.toFixed(2)}
                        </Option>
                      ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="name"
                  label="Nome Completo"
                  rules={[
                    { required: true, message: "Nome é obrigatório" },
                    {
                      min: 2,
                      message: "Nome deve ter pelo menos 2 caracteres",
                    },
                  ]}
                >
                  <Input placeholder="Nome completo" size="large" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="email"
                  label="Email"
                  rules={[
                    { required: true, message: "Email é obrigatório" },
                    { type: "email", message: "Email inválido" },
                  ]}
                >
                  <Input placeholder="email@exemplo.com" size="large" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="cpf"
                  label="CPF"
                  rules={[
                    { required: true, message: "CPF é obrigatório" },
                    {
                      pattern: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
                      message: "CPF deve estar no formato 000.000.000-00",
                    },
                  ]}
                >
                  <Input
                    placeholder="000.000.000-00"
                    size="large"
                    onChange={(e) => {
                      const formatted = formatCPF(e.target.value);
                      form.setFieldValue("cpf", formatted);
                    }}
                    maxLength={14}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="phone"
                  label="Telefone"
                  rules={[
                    { required: true, message: "Telefone é obrigatório" },
                    {
                      pattern: /^\(\d{2}\) \d{4,5}-\d{4}$/,
                      message: "Telefone deve estar no formato (00) 00000-0000",
                    },
                  ]}
                >
                  <Input
                    placeholder="(00) 00000-0000"
                    size="large"
                    onChange={(e) => {
                      const formatted = formatPhone(e.target.value);
                      form.setFieldValue("phone", formatted);
                    }}
                    maxLength={15}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  name="status"
                  label="Status da Inscrição"
                  rules={[{ required: true, message: "Status é obrigatório" }]}
                >
                  <Select placeholder="Selecione o status" size="large">
                    <Option value="CONFIRMED">
                      <Tag color="green">Confirmado</Tag>
                    </Option>
                    <Option value="PENDING">
                      <Tag color="orange">Pendente</Tag>
                    </Option>
                    <Option value="CANCELLED">
                      <Tag color="red">Cancelado</Tag>
                    </Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <div className="flex gap-3 pt-4 border-t">
              <Button onClick={() => setIsModalVisible(false)} size="large">
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" size="large">
                {editingRegistration ? "Atualizar" : "Criar"} Inscrição
              </Button>
            </div>
          </Form>
        </Modal>
      </div>
    </div>
  );
}
