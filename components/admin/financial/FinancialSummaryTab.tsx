"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Select,
  Skeleton,
  Space,
  Table,
  Typography,
  message,
} from "antd";
import { DownloadOutlined, PrinterOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useAuth } from "@/hooks/useAuth";
import {
  GATEWAY_CHANNEL_ORDER,
  METHOD_ORDER,
  type MethodKey,
  type MoneyLine,
} from "@/backend/utils/revenueBreakdown";
import FinancialPrintReport from "./FinancialPrintReport";
import {
  CHANNEL_LABELS,
  CRITERIA_NOTES,
  METHOD_LABELS,
  formatBRL,
  type FinancialEventLine,
  type FinancialPeriod,
  type FinancialReport,
} from "./types";
import { downloadFinancialCsv } from "./financialCsv";

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

type DateRange = [dayjs.Dayjs, dayjs.Dayjs] | null;

function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "error" | "primary";
}) {
  const toneClass = {
    default: "text-gray-900",
    success: "text-success-700",
    warning: "text-warning-700",
    error: "text-error-700",
    primary: "text-primary-700",
  }[tone];
  return (
    <Card size="small" className="h-full">
      <div className="text-sm text-gray-600">{label}</div>
      <div className={`text-xl font-semibold ${toneClass}`}>{value}</div>
      {hint && <div className="text-xs text-gray-600 mt-1">{hint}</div>}
    </Card>
  );
}

const moneyCol = <T,>(
  title: string,
  key: keyof T & string
): ColumnsType<T>[number] => ({
  title,
  dataIndex: key,
  key,
  align: "right",
  render: (v: number) => formatBRL(v),
});

function lineColumns(firstTitle: string): ColumnsType<MoneyLine & { label: string }> {
  return [
    { title: firstTitle, dataIndex: "label", key: "label" },
    { title: "Inscrições", dataIndex: "registrations", key: "registrations", align: "right" },
    moneyCol<MoneyLine>("Bruto", "gross"),
    moneyCol<MoneyLine>("Camisa", "shirt"),
    moneyCol<MoneyLine>("Taxas (est.)", "fees"),
    moneyCol<MoneyLine>("Estornos", "refunds"),
    moneyCol<MoneyLine>("Líquido", "net"),
  ] as ColumnsType<MoneyLine & { label: string }>;
}

export default function FinancialSummaryTab() {
  const { user } = useAuth();
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>([
    dayjs().subtract(1, "month").startOf("day"),
    dayjs().endOf("day"),
  ]);
  const [selectedEvent, setSelectedEvent] = useState<string>("ALL");
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [exporting, setExporting] = useState(false);

  const buildParams = useCallback(
    (extra?: Record<string, string>) => {
      const params = new URLSearchParams(extra);
      if (dateRange) {
        params.set("startDate", dateRange[0].toISOString());
        params.set("endDate", dateRange[1].toISOString());
      }
      if (selectedEvent !== "ALL") params.set("eventId", selectedEvent);
      return params;
    },
    [dateRange, selectedEvent]
  );

  const period: FinancialPeriod = {
    start: dateRange ? dateRange[0].toISOString() : null,
    end: dateRange ? dateRange[1].toISOString() : null,
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/financial?${buildParams()}`);
        const data = await response.json();
        if (cancelled) return;
        if (data.success) setReport(data.data);
        else setError(data.error ?? "Não foi possível carregar o financeiro.");
      } catch {
        if (!cancelled) setError("Não foi possível carregar o financeiro.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildParams]);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/events");
        const data = await response.json();
        if (data.success) setEvents(data.data.items || []);
      } catch {
        // seletor fica só com "Todos os eventos"
      }
    })();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch(
        `/api/admin/financial?${buildParams({ format: "export" })}`
      );
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      downloadFinancialCsv(data.data, period);
      message.success("Relatório exportado.");
    } catch {
      message.error("Não foi possível exportar. Tente novamente.");
    } finally {
      setExporting(false);
    }
  };

  const summary = report?.summary;
  const canPrint = selectedEvent !== "ALL" && !!report;
  const isEmpty =
    !!summary &&
    summary.confirmedRegistrations === 0 &&
    summary.pendingRegistrations === 0 &&
    summary.refunds.count === 0 &&
    summary.standaloneShirts.count === 0;

  const methodRows = summary
    ? METHOD_ORDER.filter(
        (m: MethodKey) => summary.byMethod[m].registrations > 0 || summary.byMethod[m].gross > 0
      ).map((m) => ({ key: m, label: METHOD_LABELS[m], ...summary.byMethod[m] }))
    : [];
  const channelRows = summary
    ? GATEWAY_CHANNEL_ORDER.filter(
        (c) => summary.byChannel[c].registrations > 0 || summary.byChannel[c].gross > 0
      ).map((c) => ({ key: c, label: CHANNEL_LABELS[c], ...summary.byChannel[c] }))
    : [];

  const eventColumns: ColumnsType<FinancialEventLine> = [
    { title: "Evento", dataIndex: "eventTitle", key: "eventTitle" },
    { title: "Confirmadas", dataIndex: "confirmedRegistrations", key: "c", align: "right" },
    moneyCol<FinancialEventLine>("Bruto", "gross"),
    moneyCol<FinancialEventLine>("Camisa", "shirtRevenue"),
    moneyCol<FinancialEventLine>("Taxas (est.)", "fees"),
    moneyCol<FinancialEventLine>("Estornos", "refunds"),
    moneyCol<FinancialEventLine>("Líquido", "net"),
    moneyCol<FinancialEventLine>("Pendente", "pendingAmount"),
  ];

  return (
    <div>
      <Card className="mb-4 print:hidden">
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} md={8}>
            <label htmlFor="financial-event" className="block text-sm mb-1">
              Evento
            </label>
            <Select
              id="financial-event"
              value={selectedEvent}
              onChange={(value) => {
                setSelectedEvent(value);
                // Prestação de contas de um evento: período todo, sem recorte de datas.
                setDateRange(value === "ALL"
                  ? [dayjs().subtract(1, "month").startOf("day"), dayjs().endOf("day")]
                  : null);
              }}
              style={{ width: "100%" }}
              options={[
                { value: "ALL", label: "Todos os eventos" },
                ...events.map((e) => ({ value: e.id, label: e.title })),
              ]}
            />
          </Col>
          <Col xs={24} md={8}>
            <label className="block text-sm mb-1">Período das inscrições</label>
            <RangePicker
              value={dateRange}
              onChange={(dates) =>
                setDateRange(dates && dates[0] && dates[1] ? [dates[0], dates[1]] : null)
              }
              format="DD/MM/YYYY"
              placeholder={["Data início", "Data fim"]}
              allowClear
              style={{ width: "100%" }}
            />
            <Text type="secondary" className="text-xs">
              {dateRange ? "Período selecionado." : "Todo o período."}
            </Text>
          </Col>
          <Col xs={24} md={8}>
            <Space wrap>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExport}
                loading={exporting}
                size="large"
              >
                Exportar CSV
              </Button>
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                onClick={() => window.print()}
                disabled={!canPrint}
                size="large"
              >
                Imprimir
              </Button>
            </Space>
            {!canPrint && (
              <div className="text-xs text-gray-600 mt-1">
                Para imprimir, escolha um evento.
              </div>
            )}
          </Col>
        </Row>
      </Card>

      {error && (
        <Alert
          type="error"
          showIcon
          className="mb-4 print:hidden"
          message={error}
        />
      )}

      {loading && !report && <Skeleton active paragraph={{ rows: 8 }} />}

      {summary && report && (
        <div className="print:hidden space-y-4">
          {isEmpty ? (
            <Card>
              <Empty description="Nenhuma inscrição neste recorte. Ajuste o evento ou o período." />
            </Card>
          ) : (
            <>
              <Row gutter={[12, 12]}>
                <Col xs={12} lg={6}>
                  <Metric label="Receita bruta" value={formatBRL(summary.gross)} tone="primary" />
                </Col>
                <Col xs={12} lg={6}>
                  <Metric
                    label="Taxas (estimativa)"
                    value={formatBRL(summary.fees)}
                    hint="Referência InfinitePay"
                    tone="warning"
                  />
                </Col>
                <Col xs={12} lg={6}>
                  <Metric
                    label="Estornos"
                    value={formatBRL(summary.refunds.amount)}
                    hint={`${summary.refunds.count} estorno(s)`}
                    tone="error"
                  />
                </Col>
                <Col xs={12} lg={6}>
                  <Metric
                    label="Líquido"
                    value={formatBRL(summary.net)}
                    hint="Bruto - taxas - estornos"
                    tone="success"
                  />
                </Col>
              </Row>

              <Row gutter={[12, 12]}>
                <Col xs={12} lg={6}>
                  <Metric label="Receita de inscrições" value={formatBRL(summary.inscriptionRevenue)} />
                </Col>
                <Col xs={12} lg={6}>
                  <Metric
                    label="Receita de camisas"
                    value={formatBRL(summary.shirtRevenue)}
                    hint={
                      summary.standaloneShirts.count > 0
                        ? `inclui ${summary.standaloneShirts.count} camisa(s) avulsa(s)`
                        : undefined
                    }
                  />
                </Col>
                <Col xs={12} lg={6}>
                  <Metric
                    label="Inscritos confirmados"
                    value={String(summary.confirmedRegistrations)}
                  />
                </Col>
                <Col xs={12} lg={6}>
                  <Metric
                    label="Pendências de pagamento"
                    value={formatBRL(summary.pendingAmount)}
                    hint={`${summary.pendingRegistrations} inscrição(ões) aguardando`}
                    tone="warning"
                  />
                </Col>
              </Row>

              {summary.hasShirtOffer && (
                <Card size="small">
                  <Text strong>
                    {summary.withShirt} compraram inscrição + camisa /{" "}
                    {summary.withoutShirt} apenas inscrição
                  </Text>
                </Card>
              )}

              {summary.retainedAfterCancel.count > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  message={`${summary.retainedAfterCancel.count} inscrição(ões) cancelada(s) após pagamento online, sem estorno registrado (${formatBRL(
                    summary.retainedAfterCancel.amount
                  )}). Esse valor não entra nos totais; confira na tela de solicitações de estorno.`}
                />
              )}

              <Card title="Por forma de pagamento" size="small">
                <Table
                  size="small"
                  pagination={false}
                  dataSource={methodRows}
                  columns={lineColumns("Forma")}
                  scroll={{ x: 640 }}
                  locale={{ emptyText: "Sem pagamentos no recorte." }}
                />
                {channelRows.length > 0 && (
                  <>
                    <Title level={5} className="!mt-4">
                      InfinitePay por forma usada no checkout
                    </Title>
                    <Table
                      size="small"
                      pagination={false}
                      dataSource={channelRows}
                      columns={lineColumns("Forma")}
                      scroll={{ x: 640 }}
                    />
                  </>
                )}
                <Text type="secondary" className="text-xs block mt-2">
                  Registrado pela InfinitePay: {formatBRL(summary.gatewayReported)} (pode
                  incluir acréscimos de parcelamento pagos pelo participante).
                </Text>
              </Card>

              {summary.cashResponsibles.length > 0 && (
                <Card title="Dinheiro em espécie: quem está com o valor" size="small">
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="name"
                    dataSource={summary.cashResponsibles}
                    scroll={{ x: 480 }}
                    columns={[
                      { title: "Responsável", dataIndex: "name", key: "name" },
                      { title: "Inscrições", dataIndex: "registrations", key: "registrations", align: "right" },
                      { title: "Recebido", dataIndex: "gross", key: "gross", align: "right", render: (v: number) => formatBRL(v) },
                      { title: "Estornado", dataIndex: "refunds", key: "refunds", align: "right", render: (v: number) => formatBRL(v) },
                      { title: "Em mãos", dataIndex: "inHand", key: "inHand", align: "right", render: (v: number) => formatBRL(v) },
                    ]}
                  />
                </Card>
              )}

              {summary.byBatch.length > 0 && (
                <Card title="Por lote" size="small">
                  <Table
                    size="small"
                    pagination={false}
                    rowKey={(r) => r.batchId ?? "none"}
                    dataSource={summary.byBatch}
                    scroll={{ x: 480 }}
                    columns={[
                      { title: "Lote", dataIndex: "name", key: "name" },
                      { title: "Inscrições", dataIndex: "registrations", key: "registrations", align: "right" },
                      { title: "Com camisa", dataIndex: "withShirt", key: "withShirt", align: "right" },
                      { title: "Bruto", dataIndex: "gross", key: "gross", align: "right", render: (v: number) => formatBRL(v) },
                      { title: "Camisa", dataIndex: "shirt", key: "shirt", align: "right", render: (v: number) => formatBRL(v) },
                    ]}
                  />
                </Card>
              )}

              {summary.refundList.length > 0 && (
                <Card title="Estornos registrados" size="small">
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="registrationId"
                    dataSource={summary.refundList}
                    scroll={{ x: 480 }}
                    columns={[
                      { title: "Participante", dataIndex: "name", key: "name" },
                      { title: "Evento", dataIndex: "eventTitle", key: "eventTitle" },
                      {
                        title: "Data",
                        dataIndex: "refundedAt",
                        key: "refundedAt",
                        render: (v: string | null) => (v ? dayjs(v).format("DD/MM/YYYY") : "—"),
                      },
                      { title: "Valor", dataIndex: "amount", key: "amount", align: "right", render: (v: number) => formatBRL(v) },
                    ]}
                  />
                </Card>
              )}

              {selectedEvent === "ALL" && report.byEvent.length > 0 && (
                <Card title="Por evento" size="small">
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="eventId"
                    dataSource={report.byEvent}
                    columns={eventColumns}
                    scroll={{ x: 760 }}
                  />
                </Card>
              )}

              <Card title="Critérios usados" size="small">
                <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                  {CRITERIA_NOTES.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </div>
      )}

      {canPrint && report && (
        <FinancialPrintReport
          report={report}
          period={period}
          issuedBy={user?.name ?? user?.email ?? ""}
        />
      )}
    </div>
  );
}
