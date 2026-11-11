"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Empty,
  InputNumber,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  Spin,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import { WhatsAppOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text, Paragraph } = Typography;

type RequestStatus = "OPEN" | "IN_CONTACT" | "RESOLVED";
type Resolution =
  | "REFUNDED"
  | "DENIED"
  | "WITHDRAWN"
  | "CANCELLED_NO_REFUND"
  | null;

interface RefundItem {
  id: string;
  status: RequestStatus;
  resolution: Resolution;
  origin: "PARTICIPANT" | "ADMIN";
  reason: string;
  adminNotes: string | null;
  refundedAmount: number | null;
  refundedAt: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  createdAt: string;
  paidAmount: number;
  registration: {
    id: string;
    name: string;
    status: "PENDING" | "CONFIRMED" | "CANCELLED" | "PAYMENT_FAILED";
    paymentMethod: string;
    phoneE164: string | null;
    groupSize: number | null;
  };
  event: { id: string; title: string };
}

const PAGE_SIZE = 10;

const formatBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

const STATUS_TAG: Record<RequestStatus, { color: string; text: string }> = {
  OPEN: { color: "orange", text: "Aguardando contato" },
  IN_CONTACT: { color: "blue", text: "Em contato" },
  RESOLVED: { color: "default", text: "Encerrada" },
};

const RESOLUTION_TEXT: Record<Exclude<Resolution, null>, string> = {
  REFUNDED: "Estornado",
  DENIED: "Negado",
  WITHDRAWN: "Desistência / reativada",
  CANCELLED_NO_REFUND: "Cancelada sem estorno",
};

function whatsappUrl(item: RefundItem): string | null {
  if (!item.registration.phoneE164) return null;
  const first = item.registration.name.trim().split(/\s+/)[0];
  const text =
    item.origin === "PARTICIPANT"
      ? `Olá, ${first}! Aqui é da organização de "${item.event.title}". Recebemos seu pedido de cancelamento (motivo: ${item.reason}). Podemos conversar sobre ele?`
      : `Olá, ${first}! Aqui é da organização de "${item.event.title}". Sua inscrição foi cancelada e queremos combinar com você os próximos passos. Podemos conversar?`;
  return `https://wa.me/${item.registration.phoneE164.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export default function RefundRequestsPage() {
  const [tab, setTab] = useState<"ACTIVE" | "RESOLVED">("ACTIVE");
  const [eventId, setEventId] = useState<string>("ALL");
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [items, setItems] = useState<RefundItem[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [refundTarget, setRefundTarget] = useState<RefundItem | null>(null);
  const [refundAmount, setRefundAmount] = useState<number | null>(null);
  const [refundConfirmed, setRefundConfirmed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: tab,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (eventId !== "ALL") params.set("eventId", eventId);
      const response = await fetch(
        `/api/admin/refund-requests?${params.toString()}`
      );
      const json = await response.json();
      if (!json.success) throw new Error(json.error);
      setItems(json.data.items);
      setTotal(json.data.pagination.total);
      setActiveCount(json.data.activeCount);
    } catch {
      message.error("Não foi possível carregar as solicitações");
    } finally {
      setLoading(false);
    }
  }, [tab, page, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setEvents(
            (json.data.items ?? []).map((e: { id: string; title: string }) => ({
              id: e.id,
              title: e.title,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const act = async (
    item: RefundItem,
    body: Record<string, unknown>,
    successMessage: string
  ): Promise<boolean> => {
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/admin/refund-requests/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!json.success) {
        message.error(json.error ?? "Não foi possível concluir a ação");
        return false;
      }
      message.success(successMessage);
      await load();
      return true;
    } catch {
      message.error("Não foi possível concluir a ação");
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const openRefundModal = (item: RefundItem) => {
    setRefundTarget(item);
    setRefundAmount(item.paidAmount > 0 ? item.paidAmount : null);
    setRefundConfirmed(false);
  };

  const submitRefund = async () => {
    if (!refundTarget || !refundAmount) return;
    const ok = await act(
      refundTarget,
      {
        action: "register_refund",
        refundedAmount: refundAmount,
        confirmed: true,
      },
      "Estorno registrado e inscrição cancelada"
    );
    if (ok) setRefundTarget(null);
  };

  const renderActions = (item: RefundItem) => {
    const unresolved = item.status !== "RESOLVED";
    const regCancelled = item.registration.status === "CANCELLED";
    const wa = whatsappUrl(item);
    const busy = busyId === item.id;
    const canReactivate =
      regCancelled &&
      (unresolved || item.resolution === "CANCELLED_NO_REFUND") &&
      item.resolution !== "REFUNDED";
    const canReopen =
      item.status === "RESOLVED" &&
      (item.resolution === "DENIED" || item.resolution === "WITHDRAWN") &&
      !regCancelled;

    return (
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-3">
        {unresolved && wa && (
          <Button
            icon={<WhatsAppOutlined />}
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            style={{ minHeight: 40 }}
          >
            Entrar em contato
          </Button>
        )}
        {unresolved && !wa && (
          <Text type="secondary">Participante sem telefone cadastrado</Text>
        )}
        {item.status === "OPEN" && (
          <Button
            loading={busy}
            onClick={() =>
              act(item, { action: "mark_contact" }, "Marcada como em contato")
            }
            style={{ minHeight: 40 }}
          >
            Marcar em contato
          </Button>
        )}
        {unresolved && item.paidAmount > 0 && (
          <Button
            type="primary"
            danger
            loading={busy}
            onClick={() => openRefundModal(item)}
            style={{ minHeight: 40 }}
          >
            Registrar estorno e cancelar
          </Button>
        )}
        {unresolved && !regCancelled && (
          <Popconfirm
            title="Cancelar a inscrição sem estorno?"
            description="A vaga é liberada e nenhum valor é registrado como devolvido."
            okText="Cancelar inscrição"
            cancelText="Voltar"
            onConfirm={() =>
              act(
                item,
                { action: "cancel_without_refund" },
                "Inscrição cancelada sem estorno"
              )
            }
          >
            <Button loading={busy} style={{ minHeight: 40 }}>
              Cancelar sem estorno
            </Button>
          </Popconfirm>
        )}
        {unresolved && regCancelled && (
          <Popconfirm
            title="Encerrar sem registrar estorno?"
            description="A inscrição continua cancelada e nenhum valor é registrado como devolvido."
            okText="Encerrar"
            cancelText="Voltar"
            onConfirm={() =>
              act(
                item,
                { action: "cancel_without_refund" },
                "Solicitação encerrada"
              )
            }
          >
            <Button loading={busy} style={{ minHeight: 40 }}>
              Encerrar sem estorno
            </Button>
          </Popconfirm>
        )}
        {unresolved && item.origin === "PARTICIPANT" && !regCancelled && (
          <Popconfirm
            title="Negar o pedido?"
            description="A inscrição continua ativa."
            okText="Negar pedido"
            cancelText="Voltar"
            onConfirm={() =>
              act(item, { action: "deny" }, "Pedido negado")
            }
          >
            <Button loading={busy} style={{ minHeight: 40 }}>
              Negar
            </Button>
          </Popconfirm>
        )}
        {canReactivate && (
          <Popconfirm
            title="Reativar a inscrição?"
            description="A inscrição volta a ficar confirmada, se houver vaga. O pagamento já feito continua válido."
            okText="Reativar"
            cancelText="Voltar"
            onConfirm={() =>
              act(item, { action: "reactivate" }, "Inscrição reativada")
            }
          >
            <Button loading={busy} style={{ minHeight: 40 }}>
              Reativar inscrição
            </Button>
          </Popconfirm>
        )}
        {canReopen && (
          <Button
            loading={busy}
            onClick={() => act(item, { action: "reopen" }, "Pedido reaberto")}
            style={{ minHeight: 40 }}
          >
            Reabrir
          </Button>
        )}
      </div>
    );
  };

  const renderItem = (item: RefundItem) => {
    const tag = STATUS_TAG[item.status];
    return (
      <Card key={item.id} size="small" data-testid="refund-card">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <Text strong>{item.registration.name}</Text>
          <Tag color={tag.color}>{tag.text}</Tag>
          {item.resolution && (
            <Tag color={item.resolution === "REFUNDED" ? "green" : "default"}>
              {RESOLUTION_TEXT[item.resolution]}
            </Tag>
          )}
          {item.origin === "ADMIN" && <Tag>Cancelada pela organização</Tag>}
          {item.registration.status === "CANCELLED" && (
            <Tag color="red">Inscrição cancelada</Tag>
          )}
        </div>
        <Text type="secondary">{item.event.title}</Text>
        <div className="mt-2 text-sm text-gray-700 flex flex-col gap-1">
          <span>
            Valor pago: <b>{formatBRL(item.paidAmount)}</b>
            {item.registration.groupSize && item.registration.groupSize > 1
              ? ` (parte desta pessoa numa compra em grupo de ${item.registration.groupSize})`
              : ""}
          </span>
          <span>Motivo: {item.reason}</span>
          <span>Pedido em {dayjs(item.createdAt).format("DD/MM/YYYY HH:mm")}</span>
          {item.refundedAmount != null && (
            <span>
              Estornado: <b>{formatBRL(item.refundedAmount)}</b>
              {item.refundedAt
                ? ` em ${dayjs(item.refundedAt).format("DD/MM/YYYY")}`
                : ""}
              {item.resolvedByName ? ` por ${item.resolvedByName}` : ""}
            </span>
          )}
          {item.adminNotes && <span>Observação: {item.adminNotes}</span>}
        </div>
        {renderActions(item)}
      </Card>
    );
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
      <div className="mb-4">
        <Title level={2} style={{ marginBottom: 4 }}>
          Solicitações de estorno
        </Title>
        <Text type="secondary">
          Pedidos de cancelamento dos participantes e cancelamentos feitos pela
          organização.
        </Text>
      </div>

      <Alert
        type="info"
        showIcon
        className="mb-4"
        message="O estorno é feito manualmente no app da InfinitePay"
        description="O sistema não devolve dinheiro sozinho. Faça o estorno no app da InfinitePay e depois registre aqui para cancelar a inscrição e liberar a vaga."
      />

      <div className="mb-4">
        <Select
          value={eventId}
          onChange={(v) => {
            setEventId(v);
            setPage(1);
          }}
          style={{ width: "100%", maxWidth: 360 }}
          size="large"
          options={[
            { value: "ALL", label: "Todos os eventos" },
            ...events.map((e) => ({ value: e.id, label: e.title })),
          ]}
        />
      </div>

      <Tabs
        activeKey={tab}
        onChange={(key) => {
          setTab(key as "ACTIVE" | "RESOLVED");
          setPage(1);
        }}
        items={[
          {
            key: "ACTIVE",
            label: `Em andamento${activeCount ? ` (${activeCount})` : ""}`,
          },
          { key: "RESOLVED", label: "Encerradas" },
        ]}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : items.length === 0 ? (
        <Empty
          description={
            tab === "ACTIVE"
              ? "Nenhuma solicitação em andamento"
              : "Nenhuma solicitação encerrada"
          }
        />
      ) : (
        <div className="flex flex-col gap-3">{items.map(renderItem)}</div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex justify-center mt-4">
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={total}
            onChange={setPage}
            showSizeChanger={false}
          />
        </div>
      )}

      <Modal
        title="Registrar estorno"
        open={!!refundTarget}
        onCancel={() => setRefundTarget(null)}
        onOk={submitRefund}
        okText="Registrar e cancelar inscrição"
        cancelText="Voltar"
        okButtonProps={{
          danger: true,
          disabled: !refundConfirmed || !refundAmount,
          loading: busyId === refundTarget?.id,
        }}
        destroyOnHidden
      >
        {refundTarget && (
          <div className="flex flex-col gap-3">
            <Paragraph style={{ marginBottom: 0 }}>
              <b>Passo a passo:</b>
            </Paragraph>
            <ol className="list-decimal pl-5 text-sm text-gray-700 flex flex-col gap-1">
              <li>
                No app da InfinitePay, localize a venda de{" "}
                <b>{refundTarget.registration.name}</b> e faça o estorno (total
                ou parcial). É preciso ter saldo, e Pix pode ser devolvido em
                até 90 dias.
              </li>
              <li>Informe abaixo o valor que foi devolvido.</li>
              <li>
                Confirme. A inscrição será cancelada e a vaga liberada.
              </li>
            </ol>
            <div>
              <Text>Valor estornado (pago: {formatBRL(refundTarget.paidAmount)})</Text>
              <InputNumber
                value={refundAmount}
                onChange={(v) => setRefundAmount(v)}
                min={0.01}
                max={refundTarget.paidAmount}
                step={0.01}
                decimalSeparator=","
                prefix="R$"
                inputMode="decimal"
                style={{ width: "100%" }}
                size="large"
              />
            </div>
            <Checkbox
              checked={refundConfirmed}
              onChange={(e) => setRefundConfirmed(e.target.checked)}
            >
              Já fiz o estorno no app da InfinitePay
            </Checkbox>
          </div>
        )}
      </Modal>
    </div>
  );
}
