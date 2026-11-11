import dayjs from "dayjs";
import type {
  FinancialSummary,
  RegistrationRow,
} from "@/backend/utils/revenueBreakdown";
import {
  CHANNEL_LABELS,
  METHOD_LABELS,
  type FinancialPeriod,
} from "./types";

interface ExportPayload {
  summary: FinancialSummary;
  rows: RegistrationRow[];
  shirtOrders: { id: string; eventTitle: string; amount: number }[];
}

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada (estornada)",
};

/** Número no formato do Excel brasileiro (vírgula), sem símbolo, para somar. */
const num = (v: number) => v.toFixed(2).replace(".", ",");

function cell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function buildFinancialCsv(
  data: ExportPayload,
  period: FinancialPeriod
): string {
  const header = [
    "Evento",
    "Participante",
    "Situação",
    "Forma de pagamento",
    "Forma no checkout",
    "Responsável pelo dinheiro",
    "Lote",
    "Grupo (pedido)",
    "Camisa",
    "Valor da inscrição",
    "Valor da camisa",
    "Valor total",
    "Taxa estimada",
    "Estorno",
    "Data da inscrição",
    "Data do pagamento",
  ];

  const lines: (string | number)[][] = [header];
  for (const r of data.rows) {
    lines.push([
      r.eventTitle,
      r.name,
      STATUS_LABELS[r.status] ?? r.status,
      r.method === "FREE" ? "Gratuito" : METHOD_LABELS[r.method],
      r.channel ? CHANNEL_LABELS[r.channel] : "",
      r.cashResponsible ?? "",
      r.batchName ?? "Sem lote",
      r.orderId ?? "",
      r.wantsShirt ? "Sim" : "Não",
      num(r.inscription),
      num(r.shirt),
      num(r.total),
      num(r.fee),
      num(r.refunded),
      dayjs(r.createdAt).format("DD/MM/YYYY"),
      r.paymentDate ? dayjs(r.paymentDate).format("DD/MM/YYYY") : "",
    ]);
  }
  for (const o of data.shirtOrders) {
    lines.push([
      o.eventTitle,
      "Camisa avulsa",
      "Confirmada",
      METHOD_LABELS.INFINITE_PAY,
      "",
      "",
      "",
      o.id,
      "Sim",
      num(0),
      num(o.amount),
      num(o.amount),
      num(0),
      num(0),
      "",
      "",
    ]);
  }

  const s = data.summary;
  const blank = Array(header.length).fill("");
  const summaryLine = (label: string, value: number | string) => {
    const row: (string | number)[] = [...blank];
    row[0] = label;
    row[1] = typeof value === "number" ? num(value) : value;
    return row;
  };
  lines.push(blank);
  lines.push(
    summaryLine(
      "RESUMO - período",
      period.start && period.end
        ? `${dayjs(period.start).format("DD/MM/YYYY")} a ${dayjs(period.end).format("DD/MM/YYYY")}`
        : "Todo o período"
    ),
    summaryLine("Receita bruta", s.gross),
    summaryLine("Receita de inscrições", s.inscriptionRevenue),
    summaryLine("Receita de camisas", s.shirtRevenue),
    summaryLine("Taxas (estimativa)", s.fees),
    summaryLine("Estornos", s.refunds.amount),
    summaryLine("Líquido", s.net),
    summaryLine("Pendências de pagamento", s.pendingAmount),
    summaryLine("Inscritos confirmados", String(s.confirmedRegistrations)),
    summaryLine("Com camisa", String(s.withShirt)),
    summaryLine("Apenas inscrição", String(s.withoutShirt))
  );

  return (
    "﻿" + lines.map((l) => l.map(cell).join(";")).join("\r\n")
  );
}

export function downloadFinancialCsv(
  data: ExportPayload,
  period: FinancialPeriod
) {
  const blob = new Blob([buildFinancialCsv(data, period)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `prestacao-de-contas-${dayjs().format("YYYY-MM-DD")}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
