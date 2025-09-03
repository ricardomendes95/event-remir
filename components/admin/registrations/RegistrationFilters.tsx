"use client";

import React from "react";
import { Card, Row, Col, Input, Select, Button } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

const { Search } = Input;
const { Option } = Select;

interface RegistrationFiltersProps {
  searchInput: string;
  statusFilter: string;
  eventFilter: string;
  events: Array<{
    id: string;
    title: string;
    price: number;
    startDate: string;
    isActive: boolean;
  }>;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onEventChange: (value: string) => void;
  onRefresh: () => void;
}

export default function RegistrationFilters({
  searchInput,
  statusFilter,
  eventFilter,
  events,
  onSearchChange,
  onStatusChange,
  onEventChange,
  onRefresh,
}: RegistrationFiltersProps) {
  return (
    <Card className="mb-6">
      <Row gutter={[16, 16]} align="middle">
        <Col flex="auto">
          <Search
            placeholder="Buscar por nome, email, CPF ou evento..."
            allowClear
            size="large"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            onSearch={(value) => onSearchChange(value)}
            style={{ width: "100%" }}
          />
        </Col>
        <Col>
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={onStatusChange}
            style={{ width: 120 }}
            size="large"
          >
            <Option value="ALL">Todos</Option>
            <Option value="CONFIRMED">Confirmado</Option>
            <Option value="PENDING">Pendente</Option>
            <Option value="CANCELLED">Cancelado</Option>
          </Select>
        </Col>
        <Col>
          <Select
            placeholder="Evento"
            value={eventFilter}
            onChange={onEventChange}
            style={{ width: 200 }}
            size="large"
          >
            <Option value="ALL">Todos os Eventos</Option>
            {events.map((event) => (
              <Option key={event.id} value={event.id}>
                {event.title}
              </Option>
            ))}
          </Select>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={onRefresh} size="large">
            Atualizar
          </Button>
        </Col>
      </Row>
    </Card>
  );
}
