"use client";

import React from "react";
import dayjs from "dayjs";
import {
  GATEWAY_CHANNEL_ORDER,
  METHOD_ORDER,
  type MoneyLine,
} from "@/backend/utils/revenueBreakdown";
import {
  CHANNEL_LABELS,
  CRITERIA_NOTES,
  METHOD_LABELS,
  formatBRL,
  type FinancialPeriod,
  type FinancialReport,
} from "./types";

interface Props {
  report: FinancialReport;
  period: FinancialPeriod;
  issuedBy: string;
}

const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 14mm; }
  body * { visibility: hidden; }
  .financial-print, .financial-print * { visibility: visible; }
  .financial-print { position: absolute; left: 0; top: 0; width: 100%; }
  .financial-print section { break-inside: avoid; }
}
`;

function LineTable({
  firstTitle,
  rows,
}: {
  firstTitle: string;
  rows: ({ label: string } & MoneyLine)[];
}) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-black text-left">
          <th className="py-1">{firstTitle}</th>
          <th className="py-1 text-right">Insc.</th>
          <th className="py-1 text-right">Bruto</th>
          <th className="py-1 text-right">Camisa</th>
          <th className="py-1 text-right">Taxas (est.)</th>
          <th className="py-1 text-right">Estornos</th>
          <th className="py-1 text-right">Líquido</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-gray-400">
            <td className="py-1">{r.label}</td>
            <td className="py-1 text-right">{r.registrations}</td>
            <td className="py-1 text-right">{formatBRL(r.gross)}</td>
            <td className="py-1 text-right">{formatBRL(r.shirt)}</td>
            <td className="py-1 text-right">{formatBRL(r.fees)}</td>
            <td className="py-1 text-right">{formatBRL(r.refunds)}</td>
            <td className="py-1 text-right">{formatBRL(r.net)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Indicator({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-black p-2">
      <div className="text-[10px] uppercase">{label}</div>
      <div className="text-base font-bold">{value}</div>
    </div>
  );
}

/** Documento de prestação de contas de um evento. Só aparece na impressão. */
export default function FinancialPrintReport({ report, period, issuedBy }: Props) {
  const { summary, scope } = report;
  const periodText =
    period.start && period.end
      ? `${dayjs(period.start).format("DD/MM/YYYY")} a ${dayjs(period.end).format("DD/MM/YYYY")}`
      : "Todo o período";

  const methodRows = METHOD_ORDER.filter(
    (m) => summary.byMethod[m].registrations > 0 || summary.byMethod[m].gross > 0
  ).map((m) => ({ label: METHOD_LABELS[m], ...summary.byMethod[m] }));
  const channelRows = GATEWAY_CHANNEL_ORDER.filter(
    (c) => summary.byChannel[c].registrations > 0 || summary.byChannel[c].gross > 0
  ).map((c) => ({ label: CHANNEL_LABELS[c], ...summary.byChannel[c] }));

  return (
    <div className="financial-print hidden print:block text-black text-sm space-y-4">
      <style>{PRINT_CSS}</style>

      <header className="border-b-2 border-black pb-2">
        <h1 className="text-xl font-bold">Prestação de contas</h1>
        <div className="text-base font-semibold">{scope.eventTitle}</div>
        {scope.eventDate && (
          <div>Data do evento: {dayjs(scope.eventDate).format("DD/MM/YYYY")}</div>
        )}
        <div>Período das inscrições: {periodText}</div>
        <div>
          Emitido em {dayjs().format("DD/MM/YYYY HH:mm")}
          {issuedBy ? ` por ${issuedBy}` : ""}
        </div>
      </header>

      <section>
        <h2 className="font-bold mb-1">Resumo</h2>
        <div className="grid grid-cols-4 gap-2">
          <Indicator label="Receita bruta" value={formatBRL(summary.gross)} />
          <Indicator label="Taxas (estimativa)" value={formatBRL(summary.fees)} />
          <Indicator label="Estornos" value={formatBRL(summary.refunds.amount)} />
          <Indicator label="Líquido" value={formatBRL(summary.net)} />
        </div>
        <div className="grid grid-cols-4 gap-2 mt-2">
          <Indicator label="Inscrições" value={formatBRL(summary.inscriptionRevenue)} />
          <Indicator label="Camisas" value={formatBRL(summary.shirtRevenue)} />
          <Indicator label="Inscritos confirmados" value={String(summary.confirmedRegistrations)} />
          <Indicator
            label={`Pendências (${summary.pendingRegistrations})`}
            value={formatBRL(summary.pendingAmount)}
          />
        </div>
        {summary.hasShirtOffer && (
          <p className="mt-2">
            {summary.withShirt} compraram inscrição + camisa / {summary.withoutShirt} apenas
            inscrição.
          </p>
        )}
      </section>

      <section>
        <h2 className="font-bold mb-1">Por forma de pagamento</h2>
        <LineTable firstTitle="Forma" rows={methodRows} />
        {channelRows.length > 0 && (
          <div className="mt-2">
            <div className="font-semibold text-xs mb-1">
              InfinitePay por forma usada no checkout
            </div>
            <LineTable firstTitle="Forma" rows={channelRows} />
          </div>
        )}
      </section>

      {summary.cashResponsibles.length > 0 && (
        <section>
          <h2 className="font-bold mb-1">Dinheiro em espécie</h2>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-1">Responsável</th>
                <th className="py-1 text-right">Insc.</th>
                <th className="py-1 text-right">Recebido</th>
                <th className="py-1 text-right">Estornado</th>
                <th className="py-1 text-right">Em mãos</th>
              </tr>
            </thead>
            <tbody>
              {summary.cashResponsibles.map((c) => (
                <tr key={c.name} className="border-b border-gray-400">
                  <td className="py-1">{c.name}</td>
                  <td className="py-1 text-right">{c.registrations}</td>
                  <td className="py-1 text-right">{formatBRL(c.gross)}</td>
                  <td className="py-1 text-right">{formatBRL(c.refunds)}</td>
                  <td className="py-1 text-right">{formatBRL(c.inHand)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {summary.byBatch.length > 0 && (
        <section>
          <h2 className="font-bold mb-1">Por lote</h2>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-1">Lote</th>
                <th className="py-1 text-right">Insc.</th>
                <th className="py-1 text-right">Com camisa</th>
                <th className="py-1 text-right">Bruto</th>
                <th className="py-1 text-right">Camisa</th>
              </tr>
            </thead>
            <tbody>
              {summary.byBatch.map((b) => (
                <tr key={b.batchId ?? "none"} className="border-b border-gray-400">
                  <td className="py-1">{b.name}</td>
                  <td className="py-1 text-right">{b.registrations}</td>
                  <td className="py-1 text-right">{b.withShirt}</td>
                  <td className="py-1 text-right">{formatBRL(b.gross)}</td>
                  <td className="py-1 text-right">{formatBRL(b.shirt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {summary.refundList.length > 0 && (
        <section>
          <h2 className="font-bold mb-1">Estornos registrados</h2>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-1">Participante</th>
                <th className="py-1">Data</th>
                <th className="py-1 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {summary.refundList.map((r) => (
                <tr key={r.registrationId} className="border-b border-gray-400">
                  <td className="py-1">{r.name}</td>
                  <td className="py-1">
                    {r.refundedAt ? dayjs(r.refundedAt).format("DD/MM/YYYY") : "—"}
                  </td>
                  <td className="py-1 text-right">{formatBRL(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h2 className="font-bold mb-1">Critérios</h2>
        <ul className="list-disc pl-5 text-xs space-y-1">
          {CRITERIA_NOTES.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
