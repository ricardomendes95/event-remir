"use client";

import React from "react";
import { Drawer, Descriptions, Tag, Timeline, Button, Space, Divider } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  MANUAL_PAYMENT_TYPE_LABELS,
} from "@/backend/schemas/registrationSchemas";
import type { DynamicField } from "@/backend/schemas/dynamicFormSchemas";
import { formatProofCPF } from "@/lib/registrationProofPrint";
import { hasOpenRefund, type AdminRegistration } from "./types";


const STATUS_TAG: Record<string, { color: string; text: string }> = {
  CONFIRMED: { color: "green", text: "Confirmado" },
  PENDING: { color: "orange", text: "Pendente" },
  CANCELLED: { color: "red", text: "Cancelado" },
  PAYMENT_FAILED: { color: "red", text: "Falha no pagamento" },
};

const RESOLUTION_LABEL: Record<string, string> = {
  REFUNDED: "estorno realizado",
  DENIED: "pedido negado",
  WITHDRAWN: "participante desistiu / inscrição reativada",
  CANCELLED_NO_REFUND: "cancelada sem estorno",
};

const fmt = (iso?: string | null) =>
  iso ? dayjs(iso).format("DD/MM/YYYY HH:mm") : "—";

interface Props {
  registration: AdminRegistration | null;
  open: boolean;
  onClose: () => void;
  /** Campos dinâmicos do evento (rótulos) e se o evento oferece camisa */
  dynamicFields: DynamicField[];
  eventHasShirt: boolean;
  /** false para CHECKIN/SUPPORT: sem valores (ADR-002) */
  showValues: boolean;
  onPrintProof: (registration: AdminRegistration) => void;
  printing?: boolean;
}

function formatDynamicValue(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

export default function RegistrationDetailDrawer({
  registration,
  open,
  onClose,
  dynamicFields,
  eventHasShirt,
  showValues,
  onPrintProof,
  printing = false,
}: Props) {
  const r = registration;

  const timeline = r
    ? [
        { at: r.createdAt, color: "blue", text: "Inscrição criada" },
        ...(r.paymentDate
          ? [{ at: r.paymentDate, color: "green", text: "Pagamento confirmado" }]
          : []),
        ...(r.checkedInAt
          ? [{ at: r.checkedInAt, color: "green", text: "Check-in realizado" }]
          : []),
        ...(r.refundRequests ?? []).flatMap((req) => [
          {
            at: req.createdAt,
            color: "orange",
            text:
              req.origin === "ADMIN"
                ? "Cancelada pela organização (solicitação de estorno registrada)"
                : "Participante pediu cancelamento",
          },
          ...(req.status === "RESOLVED" && req.resolvedAt
            ? [
                {
                  at: req.resolvedAt,
                  color: "gray",
                  text: `Solicitação encerrada${
                    req.resolution
                      ? ` — ${RESOLUTION_LABEL[req.resolution] ?? req.resolution}`
                      : ""
                  }`,
                },
              ]
            : []),
        ]),
        ...(r.updatedAt !== r.createdAt
          ? [{ at: r.updatedAt, color: "gray", text: "Última alteração" }]
          : []),
      ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    : [];

  const statusTag = r ? STATUS_TAG[r.status] : undefined;

  return (
    <Drawer
      title={r ? r.name : "Detalhes da inscrição"}
      open={open}
      onClose={onClose}
      width="min(560px, 100vw)"
      destroyOnHidden
      extra={
        r && (
          <Button
            icon={<PrinterOutlined />}
            loading={printing}
            onClick={() => onPrintProof(r)}
          >
            Comprovante
          </Button>
        )
      }
    >
      {r && (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Descriptions bordered size="small" column={1} title="Participante">
            <Descriptions.Item label="Status">
              <Space wrap>
                {statusTag && <Tag color={statusTag.color}>{statusTag.text}</Tag>}
                {hasOpenRefund(r) && (
                  <Tag color="volcano">Estorno em aberto</Tag>
                )}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="CPF">{formatProofCPF(r.cpf)}</Descriptions.Item>
            <Descriptions.Item label="E-mail">{r.email ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Telefone">{r.phone ?? "—"}</Descriptions.Item>
          </Descriptions>

          <Descriptions bordered size="small" column={1} title="Inscrição">
            <Descriptions.Item label="Evento">{r.event.title}</Descriptions.Item>
            <Descriptions.Item label="Lote">{r.batch?.name ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Grupo">
              {r.order
                ? `Compra em grupo (${r.order._count.registrations} inscrições) · ${
                    r.order.registrations[0]?.id === r.id
                      ? "Responsável"
                      : `Responsável: ${r.order.registrations[0]?.name ?? "—"}`
                  }`
                : "Individual"}
            </Descriptions.Item>
            {eventHasShirt && (
              <Descriptions.Item label="Camisa">
                {r.wantsShirt ? `Sim — Tamanho ${r.shirtSize ?? "—"}` : "Não"}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Inscrita em">{fmt(r.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="Check-in">{fmt(r.checkedInAt)}</Descriptions.Item>
          </Descriptions>

          <Descriptions bordered size="small" column={1} title="Pagamento">
            <Descriptions.Item label="Método">
              {r.paymentMethod === "MANUAL"
                ? `Manual${
                    r.manualPaymentType
                      ? ` · ${MANUAL_PAYMENT_TYPE_LABELS[r.manualPaymentType]}`
                      : " (não informado)"
                  }`
                : r.paymentMethod === "FREE"
                  ? "Gratuito"
                  : r.paymentMethod === "INFINITE_PAY"
                    ? "InfinitePay"
                    : r.paymentMethod ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Data do pagamento">
              {fmt(r.paymentDate)}
            </Descriptions.Item>
            {showValues && r.event.price != null && (
              <Descriptions.Item label="Valor do evento">
                R$ {r.event.price.toFixed(2)}
              </Descriptions.Item>
            )}
            {showValues && r.paymentId && (
              <Descriptions.Item label="ID do pagamento">{r.paymentId}</Descriptions.Item>
            )}
            {r.manualPaymentType === "CASH" && r.cashResponsible && (
              <Descriptions.Item label="Dinheiro com">{r.cashResponsible}</Descriptions.Item>
            )}
            {r.notes && (
              <Descriptions.Item label="Observação">{r.notes}</Descriptions.Item>
            )}
          </Descriptions>

          {dynamicFields.length > 0 && (
            <Descriptions bordered size="small" column={1} title="Formulário do evento">
              {dynamicFields.map((field) => (
                <Descriptions.Item key={field.id} label={field.label}>
                  {formatDynamicValue(r.dynamicFormData?.[field.id])}
                </Descriptions.Item>
              ))}
            </Descriptions>
          )}

          <Divider style={{ margin: "4px 0" }} />
          <div>
            <div className="font-medium mb-3">Histórico</div>
            <Timeline
              items={timeline.map((t) => ({
                color: t.color,
                children: (
                  <div>
                    <div>{t.text}</div>
                    <div className="text-sm text-gray-500">{fmt(t.at)}</div>
                  </div>
                ),
              }))}
            />
          </div>
        </Space>
      )}
    </Drawer>
  );
}
