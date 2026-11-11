"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Form,
  message,
  Modal,
  Button,
  Typography,
  Radio,
  Checkbox,
  Space,
} from "antd";
import { UserAddOutlined, PrinterOutlined } from "@ant-design/icons";
import { Empty, Skeleton } from "antd";
import QRCode from "qrcode";
import dayjs from "dayjs";
import {
  RegistrationStats,
  RegistrationFilters,
  RegistrationTable,
  RegistrationModal,
  RegistrationDetailDrawer,
  DEFAULT_REGISTRATION_FILTERS,
  type AdminRegistration as Registration,
  type RegistrationFilterValues,
} from "../../../components/admin/registrations";
import {
  openProofPrintWindow,
  type ProofPrintData,
} from "@/lib/registrationProofPrint";
import RegistrationsPrintReport from "../../../components/admin/RegistrationsPrintReport";
import type { DynamicField } from "@/backend/schemas/dynamicFormSchemas";
import type { EventFormMode } from "@/types/event";
import { useAuth } from "@/hooks/useAuth";
import { canViewFinancialValues } from "@/lib/permissions";

import { formatPaymentSummary, escapeHtml } from "@/lib/registrationPaymentLabel";

const EVENT_STORAGE_KEY = "admin.registrations.eventId";

const { Title, Text } = Typography;

interface Event {
  id: string;
  title: string;
  price: number;
  startDate: string;
  isActive: boolean;
  isFree?: boolean;
  formMode?: EventFormMode;
  dynamicFormFields?: unknown;
  batches?: Array<{ id: string; name: string }>;
  shirtConfig?: { enabled: boolean; priceWithShirt: number; sizes: string[] };
  fixedFieldsConfig?: { email?: { required: boolean }; phone?: { required: boolean } };
}

interface RegistrationFormData {
  name: string;
  email?: string;
  cpf: string;
  phone?: string;
  eventId: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "PAYMENT_FAILED";
  dynamicFormData?: Record<string, unknown>;
  wantsShirt?: boolean;
  shirtSize?: string;
  manualPaymentType?: "PIX" | "CASH" | "CARD" | null;
  cashResponsible?: string | null;
  notes?: string | null;
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
    shirtConfig?: {
      enabled: boolean;
      priceWithShirt: number;
      sizes: string[];
    } | null;
  };
  registrations: Array<{
    id: string;
    name: string;
    email?: string | null;
    cpf: string;
    phone?: string | null;
    status: string;
    createdAt: string;
    dynamicFormData: Record<string, unknown>;
    wantsShirt?: boolean;
    shirtSize?: string | null;
    paymentMethod?: string | null;
    manualPaymentType?: "PIX" | "CASH" | "CARD" | null;
    cashResponsible?: string | null;
    notes?: string | null;
  }>;
  stats: {
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    paymentFailed: number;
    totalRevenue: number;
    withShirt?: number;
    withoutShirt?: number;
    sizeBreakdown?: Record<string, number>;
  };
  exportedAt: string;
}

export default function RegistrationsPage() {
  const { user } = useAuth();
  // Perfil define o que aparece (ADR-002): CHECKIN é somente leitura, sem valores
  const showValues = canViewFinancialValues(user?.role);
  const readOnly = user?.role === "CHECKIN";
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRegistration, setEditingRegistration] =
    useState<Registration | null>(null);
  const [detailRegistration, setDetailRegistration] =
    useState<Registration | null>(null);
  const [proofPrintingId, setProofPrintingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState("");
  const [searchInput, setSearchInput] = useState(""); // input do usuário
  const [filters, setFilters] = useState<
    Omit<RegistrationFilterValues, "search">
  >({
    status: DEFAULT_REGISTRATION_FILTERS.status,
    batch: DEFAULT_REGISTRATION_FILTERS.batch,
    payment: DEFAULT_REGISTRATION_FILTERS.payment,
    group: DEFAULT_REGISTRATION_FILTERS.group,
  });
  // Nenhum dado de inscrição é buscado antes de escolher um evento (req. 9)
  const [eventFilter, setEventFilter] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: false,
    showTotal: (total: number, range: [number, number]) =>
      `${range[0]}-${range[1]} de ${total} inscrições`,
  });
  const [stats, setStats] = useState<{
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    totalRevenue: number | null;
    nonManualRevenue: number | null;
    manualByType?: { PIX: number; CASH: number; CARD: number; NOT_INFORMED: number };
    withNotes?: number | null;
    openRefunds?: number | null;
  }>({
    total: 0,
    confirmed: 0,
    pending: 0,
    cancelled: 0,
    totalRevenue: 0,
    nonManualRevenue: 0,
  });

  // Estados de impressão
  const [isPrinting, setIsPrinting] = useState(false);
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  // Opções de impressão da camisa
  const [shirtFilter, setShirtFilter] = useState<"ALL" | "WITH" | "WITHOUT">(
    "ALL"
  );
  const [separateByShirt, setSeparateByShirt] = useState(false);

  // Parâmetros de filtro compartilhados por listagem e estatísticas
  const buildFilterParams = useCallback(
    (withSearch: boolean) => {
      const params = new URLSearchParams();
      if (eventFilter) params.append("eventId", eventFilter);
      if (filters.status !== "ALL") params.append("status", filters.status);
      if (filters.batch !== "ALL") params.append("batchId", filters.batch);
      if (filters.payment !== "ALL")
        params.append("paymentMethod", filters.payment);
      if (filters.group !== "ALL") params.append("group", filters.group);
      if (withSearch && searchText.trim())
        params.append("search", searchText.trim());
      return params;
    },
    [eventFilter, filters, searchText]
  );

  // Buscar estatísticas (ignoram a busca textual)
  const fetchStats = useCallback(async () => {
    if (!eventFilter) return;
    try {
      const response = await fetch(
        `/api/registrations/stats?${buildFilterParams(false)}`
      );
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, [eventFilter, buildFilterParams]);

  // Buscar inscrições
  const fetchRegistrations = useCallback(
    async (page = 1, pageSize = 10) => {
      if (!eventFilter) return;
      setLoading(true);
      setLoadError(null);
      try {
        const params = buildFilterParams(true);
        params.append("page", page.toString());
        params.append("limit", pageSize.toString());

        const response = await fetch(`/api/registrations?${params}`);
        const data = await response.json();

        if (data.success) {
          setRegistrations(data.data.items || []);
          setPagination((prev) => ({
            ...prev,
            current: data.data.pagination.page,
            total: data.data.pagination.total,
            pageSize: data.data.pagination.limit,
          }));
        } else {
          setLoadError(data.error || "Não foi possível carregar as inscrições.");
        }
      } catch (error) {
        setLoadError("Não foi possível carregar as inscrições.");
        console.error("Error fetching registrations:", error);
      } finally {
        setLoading(false);
      }
    },
    [eventFilter, buildFilterParams]
  );

  // Buscar eventos para o seletor e o formulário
  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch("/api/events?limit=100&includeStats=true");
      const data = await response.json();

      if (data.success) {
        const items: Event[] = data.data.items || [];
        setEvents(items);
        // Restaura o último evento escolhido nesta sessão (se ainda existir);
        // sem escolha anterior, abre no evento ativo mais recente, como o painel.
        let saved: string | null = null;
        try {
          saved = sessionStorage.getItem(EVENT_STORAGE_KEY);
        } catch {
          // sessionStorage indisponível: segue sem lembrar a seleção
        }
        if (saved && items.some((e) => e.id === saved)) {
          setEventFilter(saved);
        } else {
          const latestActive = items
            .filter((e) => e.isActive)
            .sort(
              (a, b) =>
                new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
            )[0];
          if (latestActive) setEventFilter(latestActive.id);
        }
      }
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Debounce para o search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchText(searchInput);
    }, 500); // 500ms de delay

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Evento, filtros ou busca mudaram: volta à página 1 (só com evento escolhido)
  useEffect(() => {
    if (!eventFilter) {
      setRegistrations([]);
      return;
    }
    fetchRegistrations(1, pagination.pageSize);
    fetchStats();
  }, [fetchRegistrations, fetchStats]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEventChange = (eventId: string) => {
    setEventFilter(eventId);
    // o lote pertence ao evento: limpa o filtro de lote ao trocar
    setFilters((prev) => ({ ...prev, batch: "ALL" }));
    try {
      sessionStorage.setItem(EVENT_STORAGE_KEY, eventId);
    } catch {
      // ignorado
    }
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setSearchText("");
    setFilters({
      status: DEFAULT_REGISTRATION_FILTERS.status,
      batch: DEFAULT_REGISTRATION_FILTERS.batch,
      payment: DEFAULT_REGISTRATION_FILTERS.payment,
      group: DEFAULT_REGISTRATION_FILTERS.group,
    });
  };

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

  // Abrir modal para nova inscrição
  const handleNewRegistration = () => {
    setEditingRegistration(null);
    setIsModalVisible(true);
    form.resetFields();
  };

  // Abrir modal para edição
  const handleEditRegistration = (registration: Registration) => {
    setEditingRegistration(registration);
    setIsModalVisible(true);
    form.setFieldsValue({
      ...registration,
      eventId: registration.event.id,
      cpf: formatCPF(registration.cpf),
      phone: registration.phone ? formatPhone(registration.phone) : "",
      dynamicFormData: registration.dynamicFormData ?? undefined,
    });
  };

  // Função para lidar com mudanças na paginação da tabela
  const handleTableChange = (pag: { current?: number; pageSize?: number }) => {
    if (pag.current && pag.pageSize) {
      fetchRegistrations(pag.current, pag.pageSize);
    }
  };

  // Salvar inscrição (criar ou editar)
  const handleSaveRegistration = async (values: RegistrationFormData) => {
    try {
      const formValues = values as RegistrationFormData & { paymentMethod?: string };
      const payload = {
        name: formValues.name,
        email: formValues.email || null,
        cpf: formValues.cpf.replace(/\D/g, ""),
        phone: formValues.phone ? formValues.phone.replace(/\D/g, "") : null,
        eventId: formValues.eventId,
        status: formValues.status,
        paymentMethod: formValues.paymentMethod ?? "MANUAL",
        manualPaymentType:
          formValues.paymentMethod === "MANUAL"
            ? formValues.manualPaymentType ?? null
            : null,
        cashResponsible:
          formValues.paymentMethod === "MANUAL" &&
          formValues.manualPaymentType === "CASH"
            ? formValues.cashResponsible?.trim() || null
            : null,
        notes: formValues.notes?.trim() || null,
        ...(formValues.dynamicFormData ? { dynamicFormData: formValues.dynamicFormData } : {}),
        wantsShirt: formValues.wantsShirt ?? false,
        shirtSize: formValues.wantsShirt ? formValues.shirtSize ?? null : null,
      };

      const url = editingRegistration
        ? `/api/registrations/${editingRegistration.id}`
        : "/api/registrations";

      const method = editingRegistration ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        message.success(
          editingRegistration ? "Inscrição atualizada!" : "Inscrição criada!"
        );
        setIsModalVisible(false);
        fetchRegistrations(pagination.current, pagination.pageSize);
        fetchStats();
      } else {
        message.error(data.error || "Erro ao salvar inscrição");
      }
    } catch {
      message.error("Erro ao salvar inscrição");
    }
  };

  // Excluir inscrição
  const handleDeleteRegistration = async (registrationId: string) => {
    try {
      const response = await fetch(`/api/registrations/${registrationId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        message.success("Inscrição excluída!");
        fetchRegistrations(pagination.current, pagination.pageSize);
        fetchStats(); // atualizar estatísticas
      } else {
        message.error(data.error || "Erro ao excluir inscrição");
      }
    } catch (error: unknown) {
      console.error("Error deleting registration:", error);
      message.error("Erro ao excluir inscrição");
    }
  };

  // Alterar status da inscrição
  const handleChangeStatus = async (
    registrationId: string,
    newStatus: string
  ) => {
    try {
      const response = await fetch(`/api/registrations/${registrationId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (data.success) {
        message.success("Status atualizado!");
        fetchRegistrations(pagination.current, pagination.pageSize);
        fetchStats(); // atualizar estatísticas
      } else {
        message.error(data.error || "Erro ao atualizar status");
      }
    } catch (error: unknown) {
      console.error("Error changing status:", error);
      message.error("Erro ao atualizar status");
    }
  };

  const refreshAll = () => {
    fetchRegistrations(pagination.current, pagination.pageSize);
    fetchStats();
  };

  // Cancelar (gera solicitação de estorno administrativa) ou reativar (exige vaga)
  const handleCancelRegistration = async (registration: Registration) => {
    try {
      const response = await fetch(`/api/registrations/${registration.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      const data = await response.json();
      if (data.success) {
        message.success(
          registration.paymentMethod === "FREE"
            ? "Inscrição cancelada."
            : "Inscrição cancelada. Solicitação de estorno registrada."
        );
        refreshAll();
      } else {
        message.error(data.error || "Erro ao cancelar inscrição");
      }
    } catch {
      message.error("Erro ao cancelar inscrição");
    }
  };

  const handleReactivateRegistration = async (registration: Registration) => {
    try {
      const response = await fetch(`/api/registrations/${registration.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CONFIRMED" }),
      });
      const data = await response.json();
      if (data.success) {
        message.success("Inscrição reativada.");
        refreshAll();
      } else {
        // 409: sem vaga disponível (mensagem vem do servidor)
        message.error(data.error || "Erro ao reativar inscrição");
      }
    } catch {
      message.error("Erro ao reativar inscrição");
    }
  };

  // Comprovante individual: mesmo documento (e mesma rota pública) do participante
  const handlePrintProof = async (registration: Registration) => {
    // Abre a janela já no clique, antes do fetch, para não ser bloqueada
    const target = window.open("", "_blank");
    if (!target) {
      message.warning("Permita pop-ups para imprimir o comprovante");
      return;
    }
    setProofPrintingId(registration.id);
    try {
      const response = await fetch("/api/registrations/get-by-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: registration.id }),
      });
      if (!response.ok) throw new Error("get-by-id falhou");
      const proof: ProofPrintData = await response.json();
      const qr = await QRCode.toDataURL(proof.id, {
        width: 200,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      }).catch(() => "");
      openProofPrintWindow(proof, qr, target);
    } catch {
      target.close();
      message.error("Não foi possível gerar o comprovante");
    } finally {
      setProofPrintingId(null);
    }
  };

  // Buscar dados e abrir modal de impressão
  const handlePrint = async () => {
    if (!eventFilter) {
      message.warning("Selecione um evento específico para imprimir");
      return;
    }
    setIsPrinting(true);
    try {
      const params = new URLSearchParams({ eventId: eventFilter });
      if (filters.status !== "ALL") params.append("status", filters.status);

      const response = await fetch(`/api/registrations/export-admin?${params}`);
      const data = await response.json();

      if (data.success) {
        setPrintData(data.data);
        setShowPrintModal(true);
      } else {
        message.error(data.error || "Erro ao gerar relatório");
      }
    } catch {
      message.error("Erro ao gerar relatório de impressão");
    } finally {
      setIsPrinting(false);
    }
  };

  // Abrir janela de impressão com HTML gerado
  const handleDoPrint = () => {
    if (!printData) return;

    const dynamicFields = printData.event.dynamicFormFields ?? [];
    const hasShirt = !!printData.event.shirtConfig?.enabled;

    const statusLabel: Record<string, string> = {
      CONFIRMED: "Confirmado",
      PENDING: "Pendente",
      CANCELLED: "Cancelado",
      PAYMENT_FAILED: "Falha no Pagamento",
    };
    const statusColor: Record<string, string> = {
      CONFIRMED: "#52c41a",
      PENDING: "#faad14",
      CANCELLED: "#ff4d4f",
      PAYMENT_FAILED: "#ff4d4f",
    };

    // Aplicar filtro de camisa
    const filtered = printData.registrations.filter((r) => {
      if (shirtFilter === "WITH") return !!r.wantsShirt;
      if (shirtFilter === "WITHOUT") return !r.wantsShirt;
      return true;
    });

    const dynamicHeaders = dynamicFields
      .map((f) => `<th>${f.label}</th>`)
      .join("");
    const shirtHeader = hasShirt ? `<th>Camisa</th>` : "";

    const renderRow = (
      reg: PrintData["registrations"][number],
      i: number
    ) => {
      const dynamicCells = dynamicFields
        .map((f) => {
          const val = reg.dynamicFormData?.[f.id];
          const display = Array.isArray(val)
            ? val.join(", ") || "—"
            : val != null
            ? String(val)
            : "—";
          return `<td>${display}</td>`;
        })
        .join("");
      const shirtCell = hasShirt
        ? `<td>${reg.wantsShirt ? `Sim (${reg.shirtSize ?? "—"})` : "Não"}</td>`
        : "";
      return `
          <tr>
            <td style="text-align:center">${i + 1}</td>
            <td style="font-weight:500">${reg.name}</td>
            <td>${reg.email ?? "—"}</td>
            <td>${reg.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</td>
            <td>${reg.phone ?? "—"}</td>
            <td style="color:${statusColor[reg.status] ?? "#000"};font-weight:bold">
              ${statusLabel[reg.status] ?? reg.status}
            </td>
            <td>${dayjs(reg.createdAt).format("DD/MM/YYYY HH:mm")}</td>
            <td>${escapeHtml(formatPaymentSummary(reg))}</td>
            <td>${reg.notes ? escapeHtml(reg.notes) : "—"}</td>
            ${shirtCell}
            ${dynamicCells}
          </tr>`;
    };

    const renderTable = (
      list: PrintData["registrations"]
    ) => `
  <table>
    <thead>
      <tr>
        <th>#</th><th>Nome</th><th>Email</th><th>CPF</th><th>Telefone</th><th>Status</th><th>Data Inscrição</th><th>Pagamento</th><th>Observação</th>${shirtHeader}${dynamicHeaders}
      </tr>
    </thead>
    <tbody>${list.map((r, i) => renderRow(r, i)).join("")}</tbody>
  </table>`;

    // Corpo: listas separadas (por tamanho) ou lista única
    let body = "";
    if (separateByShirt && hasShirt) {
      const sizes = printData.event.shirtConfig?.sizes ?? [];
      const withShirt = filtered.filter((r) => r.wantsShirt);
      const withoutShirt = filtered.filter((r) => !r.wantsShirt);

      // Com camisa, agrupado por tamanho
      const groups = sizes
        .map((size) => {
          const list = withShirt.filter((r) => r.shirtSize === size);
          if (list.length === 0) return "";
          return `
  <h3 style="margin:18px 0 8px">Com camisa — Tamanho ${size} (${list.length})</h3>
  ${renderTable(list)}`;
        })
        .join("");

      // Com camisa sem tamanho informado (defensivo)
      const noSize = withShirt.filter(
        (r) => !r.shirtSize || !sizes.includes(r.shirtSize)
      );
      const noSizeBlock =
        noSize.length > 0
          ? `
  <h3 style="margin:18px 0 8px">Com camisa — Sem tamanho (${noSize.length})</h3>
  ${renderTable(noSize)}`
          : "";

      const withoutBlock =
        shirtFilter !== "WITH" && withoutShirt.length > 0
          ? `
  <h3 style="margin:18px 0 8px">Sem camisa (${withoutShirt.length})</h3>
  ${renderTable(withoutShirt)}`
          : "";

      body = `${groups}${noSizeBlock}${
        shirtFilter !== "WITH" ? withoutBlock : ""
      }`;
    } else {
      body = `
  <h3 style="margin-bottom:8px">Participantes (${filtered.length})</h3>
  ${renderTable(filtered)}`;
    }

    // Resumo de contagem por tamanho
    const sizeSummary =
      hasShirt && printData.stats.sizeBreakdown
        ? `<div class="stat"><p>Com camisa</p><p style="font-size:20px;font-weight:bold;color:#722ed1">${
            printData.stats.withShirt ?? 0
          }</p></div>`
        : "";
    const sizeBreakdownLine =
      hasShirt && printData.stats.sizeBreakdown
        ? `<p style="margin-top:8px;font-size:11px;color:#666">Camisas por tamanho: ${
            Object.entries(printData.stats.sizeBreakdown)
              .map(([s, n]) => `${s}: ${n}`)
              .join(" | ") || "—"
          }</p>`
        : "";

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Lista de Inscrições - ${printData.event.title}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; padding: 20px; font-size: 11px; }
    .header { text-align:center; margin-bottom:24px; border-bottom:2px solid #000; padding-bottom:16px; }
    .header h1 { font-size:22px; margin-bottom:8px; }
    .header h2 { font-size:16px; color:#444; margin-bottom:6px; }
    .stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(120px,1fr)); gap:10px; margin-bottom:20px; }
    .stat { border:1px solid #ddd; padding:10px; text-align:center; border-radius:4px; }
    table { width:100%; border-collapse:collapse; margin-top:10px; font-size:10px; }
    th, td { border:1px solid #ddd; padding:6px 8px; text-align:left; }
    th { background:#f5f5f5; font-weight:bold; }
    h3 { page-break-after: avoid; }
    @media print { body { margin:0; } thead { display:table-header-group; } tr { page-break-inside:avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>LISTA DE INSCRIÇÕES</h1>
    <h2>${printData.event.title}</h2>
    ${printData.event.location ? `<p>Local: ${printData.event.location}</p>` : ""}
    <p>Data do Evento: ${dayjs(printData.event.startDate).format("DD/MM/YYYY HH:mm")}</p>
    <p style="font-size:10px;color:#999;margin-top:8px">Gerado em: ${dayjs(printData.exportedAt).format("DD/MM/YYYY HH:mm")}</p>
  </div>
  <div class="stats">
    <div class="stat"><p>Total</p><p style="font-size:20px;font-weight:bold;color:#1890ff">${printData.stats.total}</p></div>
    <div class="stat"><p>Confirmados</p><p style="font-size:20px;font-weight:bold;color:#52c41a">${printData.stats.confirmed}</p></div>
    <div class="stat"><p>Pendentes</p><p style="font-size:20px;font-weight:bold;color:#faad14">${printData.stats.pending}</p></div>
    ${printData.stats.cancelled > 0 ? `<div class="stat"><p>Cancelados</p><p style="font-size:20px;font-weight:bold;color:#ff4d4f">${printData.stats.cancelled}</p></div>` : ""}
    ${sizeSummary}
  </div>
  ${sizeBreakdownLine}
  ${body}
  ${!printData.event.isFree ? `<p style="margin-top:16px;font-size:11px;color:#666">Receita estimada (confirmados): ${printData.stats.totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>` : ""}
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Title level={2}>
          <UserAddOutlined className="mr-3" />
          Gestão de Inscrições
        </Title>
        <Text type="secondary">Gerencie todas as inscrições dos eventos</Text>
      </div>

      {/* Filtros e Busca */}
      <RegistrationFilters
        searchInput={searchInput}
        values={filters}
        eventId={eventFilter}
        events={events}
        onSearchChange={setSearchInput}
        onEventChange={handleEventChange}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onClear={handleClearFilters}
        onRefresh={refreshAll}
      />

      {eventsLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : !eventFilter ? (
        <Empty
          className="py-12"
          description={
            events.length === 0
              ? "Nenhum evento cadastrado ainda"
              : "Selecione um evento para ver as inscrições"
          }
        />
      ) : (
        <>
          {/* Estatísticas */}
          <RegistrationStats stats={stats} showValues={showValues} />

          {/* Tabela */}
          <RegistrationTable
            registrations={registrations}
            loading={loading}
            errorMessage={loadError}
            onRetry={refreshAll}
            pagination={pagination}
            onTableChange={handleTableChange}
            onNewRegistration={handleNewRegistration}
            onEditRegistration={handleEditRegistration}
            onChangeStatus={handleChangeStatus}
            onDeleteRegistration={handleDeleteRegistration}
            onViewDetails={setDetailRegistration}
            onPrintProof={handlePrintProof}
            onCancelRegistration={handleCancelRegistration}
            onReactivateRegistration={handleReactivateRegistration}
            onPrint={handlePrint}
            isPrinting={isPrinting}
            printDisabled={!eventFilter}
            showValues={showValues}
            readOnly={readOnly}
            canManage={showValues}
          />
        </>
      )}

      <RegistrationDetailDrawer
        registration={detailRegistration}
        open={!!detailRegistration}
        onClose={() => setDetailRegistration(null)}
        dynamicFields={
          (events.find((e) => e.id === detailRegistration?.event.id)
            ?.dynamicFormFields as DynamicField[] | undefined) ?? []
        }
        eventHasShirt={
          !!events.find((e) => e.id === detailRegistration?.event.id)
            ?.shirtConfig?.enabled
        }
        showValues={showValues}
        onPrintProof={handlePrintProof}
        printing={proofPrintingId === detailRegistration?.id}
      />

      {/* Modal de Criar/Editar Inscrição */}
      <RegistrationModal
        isVisible={isModalVisible}
        editingRegistration={editingRegistration}
        events={events}
        form={form}
        onCancel={() => setIsModalVisible(false)}
        onSave={handleSaveRegistration}
        showValues={showValues}
      />

      {/* Modal de Preview de Impressão */}
      <Modal
        title="Lista de Inscrições"
        open={showPrintModal}
        onCancel={() => setShowPrintModal(false)}
        width="90%"
        style={{ top: 20 }}
        footer={[
          <Button key="cancel" onClick={() => setShowPrintModal(false)}>
            Cancelar
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handleDoPrint}
          >
            Imprimir
          </Button>,
        ]}
      >
        {/* Opções de impressão da camisa */}
        {printData?.event.shirtConfig?.enabled && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              background: "#fafafa",
              border: "1px solid #eee",
              borderRadius: 8,
            }}
          >
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <div>
                <Text strong style={{ marginRight: 12 }}>
                  Camisa:
                </Text>
                <Radio.Group
                  value={shirtFilter}
                  onChange={(e) => setShirtFilter(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="ALL">Todos</Radio.Button>
                  <Radio.Button value="WITH">Com camisa</Radio.Button>
                  <Radio.Button value="WITHOUT">Sem camisa</Radio.Button>
                </Radio.Group>
              </div>
              <Checkbox
                checked={separateByShirt}
                onChange={(e) => setSeparateByShirt(e.target.checked)}
              >
                Imprimir listas separadas por tamanho (com camisa) e sem camisa
              </Checkbox>
            </Space>
          </div>
        )}

        {printData && <RegistrationsPrintReport data={printData} />}
      </Modal>
    </div>
  );
}
