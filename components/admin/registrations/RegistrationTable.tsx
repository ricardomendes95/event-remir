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
  PrinterOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import {
  MANUAL_PAYMENT_TYPE_LABELS,
  type ManualPaymentTypeValue,
} from "@/backend/schemas/registrationSchemas";

const { Option } = Select;

interface Registration {
  id: string;
  name: string;
  email: string | null;
  cpf: string;
  phone: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "PAYMENT_FAILED";
  paymentId?: string;
  paymentMethod?: string;
  manualPaymentType?: ManualPaymentTypeValue | null;
  cashResponsible?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  batch?: { id: string; name: string } | null;
  order?: {
    id: string;
    status: string;
    registrations: { id: string; name: string }[];
    _count: { registrations: number };
  } | null;
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
  onPrint?: () => void;
  isPrinting?: boolean;
  printDisabled?: boolean;
  /** false para perfis sem acesso a valores financeiros (ADR-002) */
  showValues?: boolean;
  /** true para perfil CHECKIN: sem criar/editar/excluir/imprimir */
  readOnly?: boolean;
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
  onPrint,
  isPrinting = false,
  printDisabled = false,
  showValues = true,
  readOnly = false,
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
          <div className="text-sm text-gray-500">{record.email ?? "—"}</div>
          {record.order && (
            <Tooltip
              title={`Compra em grupo com ${record.order._count.registrations} inscrições`}
            >
              <Tag color="blue" className="mt-1" data-testid="group-tag">
                Grupo
                {record.order.registrations[0]?.id === record.id
                  ? " · Responsável"
                  : record.order.registrations[0]
                    ? ` · Resp.: ${record.order.registrations[0].name}`
                    : ""}
              </Tag>
            </Tooltip>
          )}
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
      render: (text) => (text ? formatPhone(text) : "—"),
    },
    {
      title: "Evento",
      dataIndex: "event",
      key: "event",
      render: (event) => (
        <div>
          <div className="font-medium">{event.title}</div>
          {showValues && event.price != null && (
            <div className="text-sm text-gray-500">
              R$ {event.price.toFixed(2)}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Lote",
      key: "batch",
      render: (_, record) => record.batch?.name ?? "—",
    },
    {
      title: "Pagamento",
      key: "payment",
      render: (_, record) => {
        const manualLabel = record.manualPaymentType
          ? MANUAL_PAYMENT_TYPE_LABELS[record.manualPaymentType]
          : null;
        const tag =
          record.paymentMethod === "MANUAL" ? (
            record.manualPaymentType ? (
              <Tag color={record.manualPaymentType === "CASH" ? "gold" : "orange"}>
                Manual · {manualLabel}
              </Tag>
            ) : (
              <Tag>Manual (não informado)</Tag>
            )
          ) : record.paymentMethod === "FREE" ? (
            <Tag color="green">Gratuito</Tag>
          ) : record.paymentMethod ? (
            <Tag color="blue">InfinitePay</Tag>
          ) : (
            "—"
          );

        return (
          <div>
            {tag}
            {record.manualPaymentType === "CASH" && record.cashResponsible && (
              <div className="text-sm text-gray-500">
                Com: {record.cashResponsible}
              </div>
            )}
            {record.notes && (
              <Tooltip title={record.notes}>
                <Tag
                  icon={<MessageOutlined />}
                  className="mt-1 cursor-help"
                  aria-label="Ver observação"
                >
                  Observação
                </Tag>
              </Tooltip>
            )}
          </div>
        );
      },
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

  const visibleColumns = readOnly
    ? columns.filter((column) => column.key !== "actions")
    : columns;

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
        <Space>
          {showValues && (
            <Tooltip
              title={printDisabled ? "Selecione um evento específico para imprimir" : "Imprimir lista de inscrições"}
            >
              <Button
                icon={<PrinterOutlined />}
                onClick={onPrint}
                loading={isPrinting}
                disabled={printDisabled}
                size="large"
              >
                Imprimir Lista
              </Button>
            </Tooltip>
          )}
          {!readOnly && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={onNewRegistration}
              size="large"
            >
              Nova Inscrição Manual
            </Button>
          )}
        </Space>
      </Row>

      <Table
        columns={visibleColumns}
        dataSource={registrations}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={onTableChange}
        scroll={{ x: 1000 }}
      />
    </Card>
  );
}
