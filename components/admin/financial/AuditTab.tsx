"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Modal,
  Row,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { formatBRL } from "./types";
import {
  MATCH_COLORS,
  MATCH_LABELS,
  type AuditCandidate,
  type AuditDetail,
  type AuditEntry,
  type AuditImportItem,
  type MatchStatus,
} from "./auditTypes";

const { Text } = Typography;

const MAX_BYTES = 2 * 1024 * 1024;
const UNCOVERED_FILTER = "UNCOVERED";
type Filter = MatchStatus | typeof UNCOVERED_FILTER | "ALL";

const cents = (value: number) => formatBRL(value / 100);
const when = (iso: string) => dayjs(iso).format("DD/MM/YYYY HH:mm");

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(json?.error ?? "Não foi possível concluir. Tente novamente.");
  }
  return json.data as T;
}

export default function AuditTab() {
  const [imports, setImports] = useState<AuditImportItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [linking, setLinking] = useState<AuditEntry | null>(null);
  const [linkTarget, setLinkTarget] = useState<string | null>(null);

  const loadImports = useCallback(async (selectLatest = false) => {
    try {
      const list = await api<AuditImportItem[]>("/api/admin/audit/imports");
      setImports(list);
      if (selectLatest || list.length > 0) {
        setSelectedId((current) => (selectLatest ? list[0]?.id ?? null : current ?? list[0]?.id ?? null));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar importações.");
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await api<AuditDetail>(`/api/admin/audit/imports/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar a importação.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImports();
  }, [loadImports]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const handleUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      message.error("Envie o arquivo .csv exportado do InfinitePay.");
      return false;
    }
    if (file.size > MAX_BYTES) {
      message.error("O arquivo é grande demais (máximo 2 MB).");
      return false;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      await api("/api/admin/audit/import", { method: "POST", body });
      message.success("Extrato importado e conferido.");
      setFilter("ALL");
      await loadImports(true);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Não foi possível importar.");
    } finally {
      setUploading(false);
    }
    return false;
  };

  const act = async (entryId: string, payload: Record<string, unknown>, okText: string) => {
    try {
      await api(`/api/admin/audit/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      message.success(okText);
      if (selectedId) await loadDetail(selectedId);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Não foi possível concluir.");
    }
  };

  const confirmLink = async () => {
    if (!linking || !linkTarget || !detail) return;
    const option = detail.linkOptions.find((o) => o.id === linkTarget);
    if (!option) return;
    await act(
      linking.id,
      {
        action: "link",
        ...(option.orderId ? { orderId: option.orderId } : { registrationId: option.registrationId }),
      },
      "Recebimento vinculado."
    );
    setLinking(null);
    setLinkTarget(null);
  };

  const checkPayment = async (candidate: AuditCandidate) => {
    try {
      const result = await api<{ paid: boolean; paidAmount: number | null; amount: number | null }>(
        "/api/admin/audit/payment-check",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            candidate.orderId ? { orderId: candidate.orderId } : { registrationId: candidate.registrationId }
          ),
        }
      );
      const value = result.paidAmount ?? result.amount;
      Modal.info({
        title: result.paid ? "Pagamento confirmado no InfinitePay" : "Pagamento não confirmado no InfinitePay",
        content: value != null ? `Valor: ${cents(value)}` : undefined,
      });
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Não foi possível consultar.");
    }
  };

  const counts = detail?.counts ?? {};
  const uncoveredPix = detail?.uncovered.filter((c) => !c.probableCard) ?? [];
  const uncoveredCard = detail?.uncovered.filter((c) => c.probableCard) ?? [];

  const summaryCards: Array<{ key: Filter; label: string; value: number; tone: string }> = [
    { key: "MATCHED", label: "Conferido", value: (counts.MATCHED ?? 0) + (counts.RESOLVED_MANUAL ?? 0), tone: "text-success-700" },
    { key: "AMOUNT_MISMATCH", label: "Valor divergente", value: counts.AMOUNT_MISMATCH ?? 0, tone: "text-warning-700" },
    { key: "UNMATCHED", label: "Recebido sem inscrição correspondente", value: counts.UNMATCHED ?? 0, tone: "text-error-700" },
    { key: "DUPLICATE_PAYMENT", label: "Recebido em duplicidade", value: counts.DUPLICATE_PAYMENT ?? 0, tone: "text-error-700" },
    { key: UNCOVERED_FILTER, label: "Inscrição confirmada sem recebimento no extrato", value: uncoveredPix.length, tone: "text-warning-700" },
    { key: "ACCOUNT_MOVEMENT", label: "Movimentação da conta", value: counts.ACCOUNT_MOVEMENT ?? 0, tone: "text-gray-900" },
  ];

  const filteredEntries = useMemo(() => {
    if (!detail) return [];
    if (filter === "ALL") return detail.entries;
    if (filter === "MATCHED") {
      return detail.entries.filter((e) => e.matchStatus === "MATCHED" || e.matchStatus === "RESOLVED_MANUAL");
    }
    return detail.entries.filter((e) => e.matchStatus === filter);
  }, [detail, filter]);

  const entryColumns: ColumnsType<AuditEntry> = [
    { title: "Data", dataIndex: "paidAt", width: 140, render: (v: string) => when(v) },
    {
      title: "Quem pagou",
      dataIndex: "payerName",
      render: (v: string | null, row) => (
        <div>
          <div>{v || row.description || "—"}</div>
          {row.matchNote && <Text type="secondary" className="text-xs">{row.matchNote}</Text>}
        </div>
      ),
    },
    {
      title: "Valor",
      dataIndex: "amountCents",
      width: 120,
      align: "right",
      render: (v: number) => cents(v),
    },
    {
      title: "Situação",
      dataIndex: "matchStatus",
      width: 220,
      render: (status: MatchStatus) => <Tag color={MATCH_COLORS[status]}>{MATCH_LABELS[status]}</Tag>,
    },
    {
      title: "Ações",
      key: "actions",
      width: 260,
      render: (_: unknown, row) => {
        if (row.kind !== "PIX_RECEIVED" || row.matchStatus === "DUPLICATE") return null;
        const pending = row.matchStatus === "UNMATCHED" || row.matchStatus === "DUPLICATE_PAYMENT";
        return (
          <Space wrap>
            {pending && (
              <Button size="small" onClick={() => { setLinking(row); setLinkTarget(row.suggestions?.[0]?.candidateId ?? null); }}>
                Vincular
              </Button>
            )}
            {pending && (
              <Button size="small" onClick={() => act(row.id, { action: "ignore" }, "Marcado como externo.")}>
                Não é inscrição
              </Button>
            )}
            {!pending && (
              <Button size="small" onClick={() => act(row.id, { action: "unlink" }, "Vínculo desfeito.")}>
                Desfazer
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const uncoveredColumns: ColumnsType<AuditCandidate> = [
    { title: "Pago em", dataIndex: "paidAt", width: 140, render: (v: string | null) => (v ? when(v) : "—") },
    {
      title: "Inscrição",
      render: (_: unknown, row) => (
        <div>
          <div>{row.label}</div>
          <Text type="secondary" className="text-xs">{row.eventTitle}</Text>
        </div>
      ),
    },
    { title: "Valor", dataIndex: "amountCents", width: 120, align: "right", render: (v: number) => cents(v) },
    {
      title: "Situação",
      width: 200,
      render: (_: unknown, row) =>
        row.probableCard ? <Tag color="blue">Provável cartão</Tag> : <Tag color="orange">Sem recebimento no extrato</Tag>,
    },
    {
      title: "Ações",
      width: 180,
      render: (_: unknown, row) =>
        row.checkable ? (
          <Button size="small" onClick={() => checkPayment(row)}>Consultar no InfinitePay</Button>
        ) : null,
    },
  ];

  return (
    <div>
      <Alert
        type="info"
        showIcon
        className="mb-4"
        message="Como funciona a conferência"
        description="Exporte o extrato (CSV) no painel do InfinitePay e envie aqui. O sistema só confere os recebimentos por Pix, comparando valor, horário e nome de quem pagou. Pagamentos no cartão aparecem no extrato apenas como depósito somado, por isso não dá para conferi-los um a um por este arquivo: eles ficam na lista de inscrições sem recebimento, marcados como provável cartão."
      />

      <Space wrap className="mb-4">
        <Upload accept=".csv" showUploadList={false} beforeUpload={handleUpload} disabled={uploading}>
          <Button type="primary" icon={<UploadOutlined />} loading={uploading}>
            Importar extrato (.csv)
          </Button>
        </Upload>
        {imports.length > 0 && (
          <Select
            className="min-w-[260px]"
            value={selectedId ?? undefined}
            onChange={(id) => { setSelectedId(id); setFilter("ALL"); }}
            aria-label="Importação"
            options={imports.map((i) => ({
              value: i.id,
              label: `${i.fileName} · ${dayjs(i.createdAt).format("DD/MM/YYYY HH:mm")}`,
            }))}
          />
        )}
      </Space>

      {error && <Alert type="error" showIcon className="mb-4" message={error} />}

      {loading && <Skeleton active />}

      {!loading && !detail && !error && (
        <Empty description="Nenhum extrato importado ainda. Envie o CSV do InfinitePay para começar." />
      )}

      {!loading && detail && (
        <>
          <div className="mb-3 text-sm text-gray-600">
            {detail.import.periodStart && detail.import.periodEnd &&
              `Período: ${dayjs(detail.import.periodStart).format("DD/MM/YYYY")} a ${dayjs(detail.import.periodEnd).format("DD/MM/YYYY")} · `}
            {detail.import.totalRows} linhas
            {detail.import.importedByName && ` · importado por ${detail.import.importedByName}`}
            {(counts.DUPLICATE ?? 0) > 0 && ` · ${counts.DUPLICATE} já importadas antes`}
          </div>

          <Row gutter={[12, 12]} className="mb-4">
            {summaryCards.map((card) => (
              <Col key={card.key} xs={12} md={8} lg={4}>
                <Card
                  size="small"
                  hoverable
                  className={`h-full ${filter === card.key ? "border-primary-500" : ""}`}
                  onClick={() => setFilter(filter === card.key ? "ALL" : card.key)}
                >
                  <div className="text-xs text-gray-600">{card.label}</div>
                  <div className={`text-xl font-semibold ${card.tone}`}>{card.value}</div>
                </Card>
              </Col>
            ))}
          </Row>

          {filter === UNCOVERED_FILTER ? null : (
            <Table
              size="small"
              rowKey="id"
              columns={entryColumns}
              dataSource={filteredEntries}
              scroll={{ x: 800 }}
              pagination={{ pageSize: 20, hideOnSinglePage: true }}
              locale={{ emptyText: "Nenhuma linha nesta situação." }}
            />
          )}

          {(filter === "ALL" || filter === UNCOVERED_FILTER) && (
            <div className="mt-6">
              <Text strong>Inscrições confirmadas no InfinitePay sem recebimento no extrato</Text>
              <Table
                size="small"
                rowKey="id"
                className="mt-2"
                columns={uncoveredColumns}
                dataSource={[...uncoveredPix, ...uncoveredCard]}
                scroll={{ x: 800 }}
                pagination={{ pageSize: 20, hideOnSinglePage: true }}
                locale={{ emptyText: "Todas as inscrições do período têm recebimento." }}
              />
            </div>
          )}
        </>
      )}

      <Modal
        open={!!linking}
        title="Vincular recebimento a uma inscrição"
        okText="Vincular"
        cancelText="Cancelar"
        okButtonProps={{ disabled: !linkTarget }}
        onOk={confirmLink}
        onCancel={() => { setLinking(null); setLinkTarget(null); }}
      >
        {linking && (
          <div className="mb-3 text-sm">
            {linking.payerName} · {cents(linking.amountCents)} · {when(linking.paidAt)}
          </div>
        )}
        <Select
          className="w-full"
          showSearch
          optionFilterProp="label"
          placeholder="Escolha a inscrição ou o pedido"
          value={linkTarget ?? undefined}
          onChange={setLinkTarget}
          options={(detail?.linkOptions ?? []).map((o) => ({
            value: o.id,
            label: `${o.label} · ${o.eventTitle} · ${cents(o.amountCents)}${o.paidAt ? ` · ${when(o.paidAt)}` : ""}`,
          }))}
        />
      </Modal>
    </div>
  );
}
