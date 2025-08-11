"use client";

import React from "react";
import { Modal, Form, Input, Select, Button, Row, Col, Tag } from "antd";
import type { FormInstance } from "antd";
import { z } from "zod";

const { Option } = Select;

// Schema de validação para inscrição manual do admin - baseado no backend
const registrationSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome muito longo"),
  email: z.string().email("Email inválido"),
  cpf: z
    .string()
    .min(11, "CPF deve ter 11 dígitos")
    .refine((cpf) => {
      // Remove formatação para validação
      const cleanCpf = cpf.replace(/\D/g, "");
      return cleanCpf.length === 11;
    }, "CPF deve ter 11 dígitos"),
  phone: z
    .string()
    .min(10, "Telefone deve ter pelo menos 10 dígitos")
    .refine((phone) => {
      // Remove formatação para validação
      const cleanPhone = phone.replace(/\D/g, "");
      return cleanPhone.length >= 10 && cleanPhone.length <= 11;
    }, "Telefone deve ter entre 10 e 11 dígitos"),
  eventId: z.string().min(1, "Evento é obrigatório"),
  status: z
    .enum(["PENDING", "CONFIRMED", "CANCELLED", "PAYMENT_FAILED"])
    .default("CONFIRMED"),
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
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "PAYMENT_FAILED";
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
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "PAYMENT_FAILED";
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
    if (cpf.length <= 11) {
      return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return value;
  };

  // Função para formatar telefone
  const formatPhone = (value: string) => {
    const phone = value.replace(/\D/g, "");
    if (phone.length <= 10) {
      return phone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    } else if (phone.length <= 11) {
      return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    return value;
  };

  // Função para validar CPF
  const validateCPF = (_: unknown, value: string) => {
    if (!value) return Promise.resolve();

    const cleanCpf = value.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      return Promise.reject(new Error("CPF deve ter 11 dígitos"));
    }
    return Promise.resolve();
  };

  // Função para validar telefone
  const validatePhone = (_: unknown, value: string) => {
    if (!value) return Promise.resolve();

    const cleanPhone = value.replace(/\D/g, "");
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      return Promise.reject(
        new Error("Telefone deve ter entre 10 e 11 dígitos")
      );
    }
    return Promise.resolve();
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
                { validator: validateCPF },
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
                { validator: validatePhone },
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
