"use client";

import React from "react";
import {
  Card,
  Table,
  Space,
  Button,
  Select,
  Popconfirm,
  Tag,
  Typography,
  Tooltip,
  Badge,
  Row,
} from "antd";

const { Title } = Typography;
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";

const { Option } = Select;

interface Registration {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "PAYMENT_FAILED";
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

interface RegistrationTableProps {
  registrations: Registration[];
  loading: boolean;
  pagination: {
    current: number;
    pageSize: number;
    total: number;
    showSizeChanger: boolean;
    showQuickJumper: boolean;
    showTotal: (total: number, range: [number, number]) => string;
  };
  onTableChange: (pag: { current?: number; pageSize?: number }) => void;
  onNewRegistration: () => void;
  onEditRegistration: (registration: Registration) => void;
  onChangeStatus: (registrationId: string, newStatus: string) => void;
  onDeleteRegistration: (registrationId: string) => void;
}

export default function RegistrationTable({
  registrations,
  loading,
  pagination,
  onTableChange,
  onNewRegistration,
  onEditRegistration,
  onChangeStatus,
  onDeleteRegistration,
}: RegistrationTableProps) {
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
        { text: "Falha no Pagamento", value: "PAYMENT_FAILED" },
      ],
      onFilter: (value, record) => record.status === value,
      render: (
        status: "PENDING" | "CONFIRMED" | "CANCELLED" | "PAYMENT_FAILED"
      ) => {
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
          PAYMENT_FAILED: {
            color: "red",
            icon: <ExclamationCircleOutlined />,
            text: "Falha no Pagamento",
          },
        };

        const config = statusConfig[status];

        // Verificação de segurança caso o status não esteja definido
        if (!config) {
          return (
            <Tag color="default" className="p-1.5">
              Status Desconhecido
            </Tag>
          );
        }

        return (
          <Tag color={config.color} icon={config.icon} className="p-1.5">
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
              onClick={() => onEditRegistration(record)}
            />
          </Tooltip>

          <Tooltip title="Alterar Status">
            <Select
              size="small"
              value={record.status}
              style={{ width: 100 }}
              onChange={(value) => onChangeStatus(record.id, value)}
            >
              <Option value="CONFIRMED">
                <Tag color="green" className="m-0 p-1.5">
                  Confirmado
                </Tag>
              </Option>
              <Option value="PENDING">
                <Tag color="orange" className="m-0 p-1.5">
                  Pendente
                </Tag>
              </Option>
              <Option value="CANCELLED">
                <Tag color="red" className="m-0 p-1.5">
                  Cancelado
                </Tag>
              </Option>
            </Select>
          </Tooltip>

          <Popconfirm
            title="Tem certeza que deseja excluir esta inscrição?"
            onConfirm={() => onDeleteRegistration(record.id)}
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
    <Card>
      <Row
        gutter={[16, 16]}
        align="middle"
        justify="space-between"
        className="mb-4"
      >
        <div className="flex items-center space-x-4">
          <Title level={4} className="mb-0">
            Lista de Inscrições
          </Title>
          <Badge count={pagination.total} showZero color="#1890ff" />
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onNewRegistration}
          size="large"
        >
          Nova Inscrição Manual
        </Button>
      </Row>

      <Table
        columns={columns}
        dataSource={registrations}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={onTableChange}
        scroll={{ x: 800 }}
      />
    </Card>
  );
}
