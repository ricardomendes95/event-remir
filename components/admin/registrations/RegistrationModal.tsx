"use client";

import React from "react";
import { Modal, Form, Input, Select, Button, Row, Col, Tag } from "antd";
import type { FormInstance } from "antd";
import { z } from "zod";

const { Option } = Select;

// Schema de validação para inscrição manual
const registrationSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  cpf: z.string().min(11, "CPF deve ter 11 dígitos").max(14, "CPF inválido"),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  eventId: z.string().min(1, "Evento é obrigatório"),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]).default("CONFIRMED"),
});

interface Event {
  id: string;
  title: string;
  price: number;
  startDate: string;
  isActive: boolean;
}

interface Registration {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
  event: {
    id: string;
    title: string;
    price: number;
    startDate: string;
  };
}

interface RegistrationFormData {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  eventId: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
}

interface RegistrationModalProps {
  isVisible: boolean;
  editingRegistration: Registration | null;
  events: Event[];
  form: FormInstance;
  onCancel: () => void;
  onSave: (values: RegistrationFormData) => void;
}

export default function RegistrationModal({
  isVisible,
  editingRegistration,
  events,
  form,
  onCancel,
  onSave,
}: RegistrationModalProps) {
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

  return (
    <Modal
      title={editingRegistration ? "Editar Inscrição" : "Nova Inscrição Manual"}
      open={isVisible}
      onCancel={onCancel}
      footer={null}
      width={600}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSave} className="mt-4">
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="eventId"
              label="Evento"
              rules={[{ required: true, message: "Evento é obrigatório" }]}
            >
              <Select placeholder="Selecione o evento" size="large">
                {events
                  .filter((event) => event.isActive)
                  .map((event) => (
                    <Option key={event.id} value={event.id}>
                      {event.title} - R$ {event.price.toFixed(2)}
                    </Option>
                  ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="name"
              label="Nome Completo"
              rules={[
                { required: true, message: "Nome é obrigatório" },
                {
                  min: 2,
                  message: "Nome deve ter pelo menos 2 caracteres",
                },
              ]}
            >
              <Input placeholder="Nome completo" size="large" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: "Email é obrigatório" },
                { type: "email", message: "Email inválido" },
              ]}
            >
              <Input placeholder="email@exemplo.com" size="large" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="cpf"
              label="CPF"
              rules={[
                { required: true, message: "CPF é obrigatório" },
                {
                  pattern: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
                  message: "CPF deve estar no formato 000.000.000-00",
                },
              ]}
            >
              <Input
                placeholder="000.000.000-00"
                size="large"
                onChange={(e) => {
                  const formatted = formatCPF(e.target.value);
                  form.setFieldValue("cpf", formatted);
                }}
                maxLength={14}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="phone"
              label="Telefone"
              rules={[
                { required: true, message: "Telefone é obrigatório" },
                {
                  pattern: /^\(\d{2}\) \d{4,5}-\d{4}$/,
                  message: "Telefone deve estar no formato (00) 00000-0000",
                },
              ]}
            >
              <Input
                placeholder="(00) 00000-0000"
                size="large"
                onChange={(e) => {
                  const formatted = formatPhone(e.target.value);
                  form.setFieldValue("phone", formatted);
                }}
                maxLength={15}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="status"
              label="Status da Inscrição"
              rules={[{ required: true, message: "Status é obrigatório" }]}
            >
              <Select placeholder="Selecione o status" size="large">
                <Option value="CONFIRMED">
                  <Tag color="green">Confirmado</Tag>
                </Option>
                <Option value="PENDING">
                  <Tag color="orange">Pendente</Tag>
                </Option>
                <Option value="CANCELLED">
                  <Tag color="red">Cancelado</Tag>
                </Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <div className="flex gap-3 pt-4 border-t">
          <Button onClick={onCancel} size="large">
            Cancelar
          </Button>
          <Button type="primary" htmlType="submit" size="large">
            {editingRegistration ? "Atualizar" : "Criar"} Inscrição
          </Button>
        </div>
      </Form>
    </Modal>
  );
}

export { registrationSchema };
