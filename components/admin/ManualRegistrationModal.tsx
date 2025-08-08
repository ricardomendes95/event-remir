"use client";

import React, { useState } from "react";
import { Modal, Form, Input, Select, Button, message } from "antd";
import { UserAddOutlined } from "@ant-design/icons";

const { Option } = Select;

interface ManualRegistrationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  events: Array<{ id: string; title: string }>;
}

interface ManualRegistrationData {
  eventId: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
}

export default function ManualRegistrationModal({
  open,
  onClose,
  onSuccess,
  events,
}: ManualRegistrationModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: ManualRegistrationData) => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/registrations/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: values.eventId,
          participantData: {
            name: values.name,
            email: values.email,
            cpf: values.cpf,
            phone: values.phone,
          },
          status: values.status,
        }),
      });

      const data = await response.json();

      if (data.success) {
        message.success("Inscrição manual criada com sucesso!");
        form.resetFields();
        onSuccess();
        onClose();
      } else {
        message.error(data.error || "Erro ao criar inscrição");
      }
    } catch (error) {
      console.error("Erro ao criar inscrição manual:", error);
      message.error("Erro ao criar inscrição manual");
    } finally {
      setLoading(false);
    }
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .substring(0, 14);
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 10) {
      return numbers
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    } else {
      return numbers
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{5})(\d)/, "$1-$2");
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center">
          <UserAddOutlined className="mr-2" />
          Nova Inscrição Manual
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ status: "CONFIRMED" }}
      >
        <Form.Item
          name="eventId"
          label="Evento"
          rules={[{ required: true, message: "Selecione um evento" }]}
        >
          <Select placeholder="Selecione o evento">
            {events.map((event) => (
              <Option key={event.id} value={event.id}>
                {event.title}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="name"
          label="Nome Completo"
          rules={[
            { required: true, message: "Nome é obrigatório" },
            { min: 2, message: "Nome deve ter pelo menos 2 caracteres" },
          ]}
        >
          <Input placeholder="Nome completo do participante" />
        </Form.Item>

        <Form.Item
          name="email"
          label="E-mail"
          rules={[
            { required: true, message: "E-mail é obrigatório" },
            { type: "email", message: "E-mail inválido" },
          ]}
        >
          <Input placeholder="email@exemplo.com" />
        </Form.Item>

        <Form.Item
          name="cpf"
          label="CPF"
          rules={[
            { required: true, message: "CPF é obrigatório" },
            { min: 14, message: "CPF inválido" },
          ]}
        >
          <Input
            placeholder="000.000.000-00"
            onChange={(e) => {
              const formatted = formatCPF(e.target.value);
              form.setFieldValue("cpf", formatted);
            }}
          />
        </Form.Item>

        <Form.Item
          name="phone"
          label="Telefone"
          rules={[
            { required: true, message: "Telefone é obrigatório" },
            { min: 14, message: "Telefone inválido" },
          ]}
        >
          <Input
            placeholder="(00) 00000-0000"
            onChange={(e) => {
              const formatted = formatPhone(e.target.value);
              form.setFieldValue("phone", formatted);
            }}
          />
        </Form.Item>

        <Form.Item
          name="status"
          label="Status da Inscrição"
          rules={[{ required: true, message: "Status é obrigatório" }]}
        >
          <Select>
            <Option value="CONFIRMED">Confirmada</Option>
            <Option value="PENDING">Pendente</Option>
            <Option value="CANCELLED">Cancelada</Option>
          </Select>
        </Form.Item>

        <Form.Item className="mb-0 text-right">
          <Button onClick={onClose} className="mr-2">
            Cancelar
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            Criar Inscrição
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
