import React from "react";
import dayjs from "dayjs";
import type { DynamicField } from "@/backend/schemas/dynamicFormSchemas";

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmado",
  PENDING: "Pendente",
  CANCELLED: "Cancelado",
  PAYMENT_FAILED: "Falha no Pagamento",
};

const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: "#52c41a",
  PENDING: "#faad14",
  CANCELLED: "#ff4d4f",
  PAYMENT_FAILED: "#ff4d4f",
};

function formatDynamicValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ") || "—";
  return String(value) || "—";
}

interface PrintRegistration {
  id: string;
  name: string;
  email?: string | null;
  cpf: string;
  phone?: string | null;
  status: string;
  createdAt: string;
  dynamicFormData: Record<string, unknown>;
}

interface PrintData {
  event: {
    id: string;
    title: string;
    location?: string | null;
    startDate: string;
    endDate?: string | null;
    price: number;
    isFree: boolean;
    dynamicFormFields: DynamicField[];
  };
  registrations: PrintRegistration[];
  stats: {
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    paymentFailed: number;
    totalRevenue: number;
  };
  exportedAt: string;
}

interface RegistrationsPrintReportProps {
  data: PrintData;
}

const cell: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: "6px 8px",
  textAlign: "left",
  fontSize: 11,
};

const headerCell: React.CSSProperties = {
  ...cell,
  backgroundColor: "#f5f5f5",
  fontWeight: "bold",
};

export default function RegistrationsPrintReport({ data }: RegistrationsPrintReportProps) {
  const dynamicFields = data.event.dynamicFormFields ?? [];

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      {/* Cabeçalho */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 24,
          borderBottom: "2px solid #000",
          paddingBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>LISTA DE INSCRIÇÕES</h1>
        <h2 style={{ fontSize: 16, margin: "0 0 6px", color: "#444" }}>
          {data.event.title}
        </h2>
        {data.event.location && (
          <p style={{ fontSize: 13, margin: "4px 0", color: "#666" }}>
            Local: {data.event.location}
          </p>
        )}
        <p style={{ fontSize: 13, margin: "4px 0", color: "#666" }}>
          Data do Evento: {dayjs(data.event.startDate).format("DD/MM/YYYY HH:mm")}
          {data.event.endDate &&
            ` até ${dayjs(data.event.endDate).format("DD/MM/YYYY HH:mm")}`}
        </p>
        <p style={{ fontSize: 11, margin: "8px 0 0", color: "#999" }}>
          Relatório gerado em: {dayjs(data.exportedAt).format("DD/MM/YYYY HH:mm")}
        </p>
      </div>

      {/* Estatísticas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          { label: "Total", value: data.stats.total, color: "#1890ff" },
          { label: "Confirmados", value: data.stats.confirmed, color: "#52c41a" },
          { label: "Pendentes", value: data.stats.pending, color: "#faad14" },
          ...(data.stats.cancelled > 0
            ? [{ label: "Cancelados", value: data.stats.cancelled, color: "#ff4d4f" }]
            : []),
          ...(data.stats.paymentFailed > 0
            ? [{ label: "Falha Pagto.", value: data.stats.paymentFailed, color: "#ff4d4f" }]
            : []),
        ].map((s) => (
          <div
            key={s.label}
            style={{ border: "1px solid #ddd", padding: 12, textAlign: "center", borderRadius: 4 }}
          >
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "#666" }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: "bold", color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <h3 style={{ fontSize: 14, marginBottom: 10, borderBottom: "1px solid #ddd", paddingBottom: 6 }}>
        Participantes ({data.registrations.length})
      </h3>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...headerCell, width: 28, textAlign: "center" }}>#</th>
            <th style={headerCell}>Nome</th>
            <th style={headerCell}>Email</th>
            <th style={headerCell}>CPF</th>
            <th style={headerCell}>Telefone</th>
            <th style={headerCell}>Status</th>
            <th style={headerCell}>Data Inscrição</th>
            {dynamicFields.map((f) => (
              <th key={f.id} style={headerCell}>
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.registrations.map((reg, i) => (
            <tr key={reg.id}>
              <td style={{ ...cell, textAlign: "center" }}>{i + 1}</td>
              <td style={{ ...cell, fontWeight: 500 }}>{reg.name}</td>
              <td style={cell}>{reg.email ?? "—"}</td>
              <td style={cell}>
                {reg.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
              </td>
              <td style={cell}>{reg.phone ?? "—"}</td>
              <td style={{ ...cell, color: STATUS_COLOR[reg.status] ?? "#000", fontWeight: "bold" }}>
                {STATUS_LABEL[reg.status] ?? reg.status}
              </td>
              <td style={cell}>{dayjs(reg.createdAt).format("DD/MM/YYYY HH:mm")}</td>
              {dynamicFields.map((f) => (
                <td key={f.id} style={cell}>
                  {formatDynamicValue(reg.dynamicFormData?.[f.id])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Rodapé */}
      <div
        style={{
          marginTop: 24,
          borderTop: "2px solid #000",
          paddingTop: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div>
          {!data.event.isFree && (
            <p style={{ fontSize: 12, margin: 0, color: "#666" }}>
              Receita estimada (confirmados):{" "}
              {data.stats.totalRevenue.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </p>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 12, margin: 0, color: "#666", borderBottom: "1px solid #000", paddingBottom: 4 }}>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          </p>
          <p style={{ fontSize: 12, margin: "4px 0 0", color: "#666", textAlign: "center" }}>
            Responsável pelo Evento
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
        }
      `}</style>
    </div>
  );
}
