"use client";

import React from "react";
import { Card, Row, Col, Input, Select, Button, Typography } from "antd";
import { ReloadOutlined, ClearOutlined } from "@ant-design/icons";

const { Search } = Input;
const { Text } = Typography;

export interface RegistrationFilterValues {
  search: string;
  status: string;
  batch: string;
  payment: string;
  group: string;
}

export const DEFAULT_REGISTRATION_FILTERS: RegistrationFilterValues = {
  search: "",
  status: "ALL",
  batch: "ALL",
  payment: "ALL",
  group: "ALL",
};

interface RegistrationFiltersProps {
  /** Valor imediato do campo de busca (a página aplica debounce) */
  searchInput: string;
  values: Omit<RegistrationFilterValues, "search">;
  /** Evento selecionado (obrigatório para carregar a lista) */
  eventId: string | null;
  events: Array<{
    id: string;
    title: string;
    batches?: Array<{ id: string; name: string }>;
  }>;
  onSearchChange: (value: string) => void;
  onEventChange: (value: string) => void;
  onChange: (patch: Partial<Omit<RegistrationFilterValues, "search">>) => void;
  onClear: () => void;
  onRefresh: () => void;
}

export default function RegistrationFilters({
  searchInput,
  values,
  eventId,
  events,
  onSearchChange,
  onEventChange,
  onChange,
  onClear,
  onRefresh,
}: RegistrationFiltersProps) {
  const selectedEvent = events.find((e) => e.id === eventId);
  const batches = selectedEvent?.batches ?? [];
  const hasActiveFilters =
    !!searchInput ||
    values.status !== "ALL" ||
    values.batch !== "ALL" ||
    values.payment !== "ALL" ||
    values.group !== "ALL";

  return (
    <Card className="mb-6">
      <Row gutter={[16, 12]} align="bottom">
        <Col xs={24} md={12} lg={10}>
          <Text strong className="block mb-1">
            Evento
          </Text>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Selecione um evento"
            value={eventId ?? undefined}
            onChange={onEventChange}
            style={{ width: "100%" }}
            size="large"
            options={events.map((event) => ({
              value: event.id,
              label: event.title,
            }))}
          />
        </Col>
        <Col xs={24} md={12} lg={14}>
          <Search
            placeholder="Buscar por nome, e-mail ou CPF..."
            allowClear
            size="large"
            disabled={!eventId}
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            onSearch={(value) => onSearchChange(value)}
            style={{ width: "100%" }}
          />
        </Col>

        <Col xs={12} md={6} lg={4}>
          <Select
            aria-label="Status"
            value={values.status}
            onChange={(status) => onChange({ status })}
            disabled={!eventId}
            style={{ width: "100%" }}
            options={[
              { value: "ALL", label: "Status: todos" },
              { value: "CONFIRMED", label: "Confirmado" },
              { value: "PENDING", label: "Pendente" },
              { value: "CANCELLED", label: "Cancelado" },
              { value: "PAYMENT_FAILED", label: "Falha no pagamento" },
            ]}
          />
        </Col>
        <Col xs={12} md={6} lg={4}>
          <Select
            aria-label="Lote"
            value={values.batch}
            onChange={(batch) => onChange({ batch })}
            disabled={!eventId || batches.length === 0}
            style={{ width: "100%" }}
            options={[
              { value: "ALL", label: "Lote: todos" },
              ...batches.map((b) => ({ value: b.id, label: b.name })),
              { value: "NONE", label: "Sem lote" },
            ]}
          />
        </Col>
        <Col xs={12} md={6} lg={4}>
          <Select
            aria-label="Pagamento"
            value={values.payment}
            onChange={(payment) => onChange({ payment })}
            disabled={!eventId}
            style={{ width: "100%" }}
            options={[
              { value: "ALL", label: "Pagamento: todos" },
              { value: "INFINITE_PAY", label: "InfinitePay" },
              { value: "MANUAL", label: "Manual" },
              { value: "FREE", label: "Gratuito" },
            ]}
          />
        </Col>
        <Col xs={12} md={6} lg={4}>
          <Select
            aria-label="Tipo de inscrição"
            value={values.group}
            onChange={(group) => onChange({ group })}
            disabled={!eventId}
            style={{ width: "100%" }}
            options={[
              { value: "ALL", label: "Individual e grupo" },
              { value: "SINGLE", label: "Só individuais" },
              { value: "GROUP", label: "Só em grupo" },
            ]}
          />
        </Col>
        <Col xs={24} lg={8} className="flex gap-2 lg:justify-end">
          <Button
            icon={<ClearOutlined />}
            onClick={onClear}
            disabled={!hasActiveFilters}
          >
            Limpar filtros
          </Button>
          <Button icon={<ReloadOutlined />} onClick={onRefresh} disabled={!eventId}>
            Atualizar
          </Button>
        </Col>
      </Row>
    </Card>
  );
}
