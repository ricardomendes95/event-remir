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
  Dropdown,
  Empty,
  Alert,
  Grid,
} from "antd";
import type { MenuProps } from "antd";

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
  EyeOutlined,
  MoreOutlined,
  FileTextOutlined,
  StopOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { MANUAL_PAYMENT_TYPE_LABELS } from "@/backend/schemas/registrationSchemas";
import { hasOpenRefund, type AdminRegistration as Registration } from "./types";

const { Option } = Select;

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
  onViewDetails: (registration: Registration) => void;
  onPrintProof: (registration: Registration) => void;
  onCancelRegistration: (registration: Registration) => void;
  onReactivateRegistration: (registration: Registration) => void;
  /** Erro de carregamento (exibe alerta com "tentar novamente") */
  errorMessage?: string | null;
  onRetry?: () => void;
  onPrint?: () => void;
  isPrinting?: boolean;
  printDisabled?: boolean;
  /** false para perfis sem acesso a valores financeiros (ADR-002) */
  showValues?: boolean;
  /** true para perfil CHECKIN: sem criar/editar/excluir/imprimir */
  readOnly?: boolean;
  /** true para ADMIN/SUPER_ADMIN: cancelar, reativar e excluir (req. 12) */
  canManage?: boolean;
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
  onViewDetails,
  onPrintProof,
  onCancelRegistration,
  onReactivateRegistration,
  errorMessage = null,
  onRetry,
  onPrint,
  isPrinting = false,
  printDisabled = false,
  showValues = true,
  readOnly = false,
  canManage = false,
}: RegistrationTableProps) {
  // No celular a coluna de ações fixa à direita espremia o nome do participante
  const screens = Grid.useBreakpoint();
  const isDesktop = !!screens.md;

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
      width: 230,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text, record) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-sm text-gray-500">{record.email ?? "—"}</div>
          {hasOpenRefund(record) && (
            <Tooltip title="Há uma solicitação de estorno aberta para esta inscrição">
              <Tag color="volcano" className="mt-1" data-testid="refund-open-tag">
                Estorno em aberto
              </Tag>
            </Tooltip>
          )}
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
          {showValues && event?.price != null && (
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
      width: 270,
      fixed: isDesktop ? "right" : undefined,
      render: (_, record) => {
        const cancelled = record.status === "CANCELLED";
        const menuItems: MenuProps["items"] = [
          {
            key: "proof",
            icon: <FileTextOutlined />,
            label: "Imprimir comprovante",
            onClick: () => onPrintProof(record),
          },
          ...(!readOnly
            ? [
                {
                  key: "edit",
                  icon: <EditOutlined />,
                  label: "Editar",
                  onClick: () => onEditRegistration(record),
                },
              ]
            : []),
        ];

        return (
          <Space size="small" wrap>
            <Tooltip title="Ver detalhes e histórico">
              <Button
                icon={<EyeOutlined />}
                size="small"
                aria-label="Ver detalhes"
                onClick={() => onViewDetails(record)}
              />
            </Tooltip>

            {!readOnly && (
              <Tooltip
                title={
                  cancelled
                    ? "Use Reativar para voltar a inscrição"
                    : "Alterar status"
                }
              >
                <Select
                  size="small"
                  value={record.status}
                  style={{ width: 108 }}
                  disabled={cancelled}
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
                  <Option value="CANCELLED" disabled>
                    <Tag color="red" className="m-0 p-1.5">
                      Cancelado
                    </Tag>
                  </Option>
                  <Option value="PAYMENT_FAILED" disabled>
                    <Tag color="red" className="m-0 p-1.5">
                      Falha
                    </Tag>
                  </Option>
                </Select>
              </Tooltip>
            )}

            {canManage && cancelled && (
              <Popconfirm
                title="Reativar esta inscrição?"
                description="Volta para Confirmado e encerra a solicitação de estorno em aberto. Exige vaga disponível."
                onConfirm={() => onReactivateRegistration(record)}
                okText="Reativar"
                cancelText="Não"
              >
                <Button size="small" icon={<UndoOutlined />}>
                  Reativar
                </Button>
              </Popconfirm>
            )}
            {canManage && !cancelled && (
              <Popconfirm
                title="Cancelar esta inscrição?"
                description={
                  record.paymentMethod === "FREE"
                    ? "A vaga é liberada."
                    : "A vaga é liberada e uma solicitação de estorno é registrada para a organização acompanhar."
                }
                onConfirm={() => onCancelRegistration(record)}
                okText="Cancelar inscrição"
                okButtonProps={{ danger: true }}
                cancelText="Voltar"
              >
                <Button size="small" danger icon={<StopOutlined />}>
                  Cancelar
                </Button>
              </Popconfirm>
            )}

            {canManage && (
              <Popconfirm
                title="Excluir esta inscrição?"
                description="A exclusão é definitiva."
                onConfirm={() => onDeleteRegistration(record.id)}
                okText="Excluir"
                okButtonProps={{ danger: true }}
                cancelText="Não"
              >
                <Tooltip title="Excluir">
                  <Button
                    icon={<DeleteOutlined />}
                    size="small"
                    danger
                    aria-label="Excluir"
                  />
                </Tooltip>
              </Popconfirm>
            )}

            <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
              <Button
                size="small"
                icon={<MoreOutlined />}
                aria-label="Mais ações"
              />
            </Dropdown>
          </Space>
        );
      },
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
        <Space wrap>
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

      {errorMessage && (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          message={errorMessage}
          action={
            onRetry && (
              <Button size="small" onClick={onRetry}>
                Tentar novamente
              </Button>
            )
          }
        />
      )}

      <Table
        columns={columns}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Nenhuma inscrição encontrada com estes filtros"
            />
          ),
        }}
        dataSource={registrations}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={onTableChange}
        scroll={{ x: 1200 }}
      />
    </Card>
  );
}
