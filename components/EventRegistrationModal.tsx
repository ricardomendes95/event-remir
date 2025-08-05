"use client";

import { useState } from "react";
import { Modal, Form, Input, Button, message } from "antd";
import { User, Mail, FileText, CreditCard } from "lucide-react";
import { Event } from "@/types/event";
import { z } from "zod";

const registrationSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  cpf: z.string().min(11, "CPF deve ter 11 dígitos").max(14, "CPF inválido"),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

interface EventRegistrationModalProps {
  event: Event;
  open: boolean;
  onClose: () => void;
}

export function EventRegistrationModal({
  event,
  open,
  onClose,
}: EventRegistrationModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const formatCPF = (value: string) => {
    const cpf = value.replace(/\D/g, "");
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const formatPhone = (value: string) => {
    const phone = value.replace(/\D/g, "");
    if (phone.length <= 10) {
      return phone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };

  const handleSubmit = async (values: RegistrationFormData) => {
    try {
      setLoading(true);

      // Validação com Zod
      const validatedData = registrationSchema.parse({
        ...values,
        cpf: values.cpf.replace(/\D/g, ""),
        phone: values.phone.replace(/\D/g, ""),
      });

      // Criar preferência de pagamento
      const response = await fetch("/api/payments/create-preference", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: event.id,
          participantData: validatedData,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao processar inscrição");
      }

      const { checkoutUrl } = await response.json();

      // Redirecionar para o checkout do Mercado Pago
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error("Erro na inscrição:", error);

      if (error instanceof z.ZodError) {
        error.issues.forEach((issue) => {
          message.error(issue.message);
        });
      } else {
        message.error("Erro ao processar inscrição. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={
        <div className="flex items-center space-x-2">
          <CreditCard className="h-5 w-5 text-blue-600" />
          <span>Inscrição - {event.name}</span>
        </div>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={600}
      destroyOnClose
    >
      <div className="py-4">
        {/* Resumo do Evento */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-2">
            Resumo da Inscrição
          </h3>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">Evento: {event.name}</p>
              <p className="text-sm text-gray-600">
                Data: {new Date(event.eventDate).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-green-600">
                {event.price.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Formulário */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              name="name"
              label={
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span>Nome Completo</span>
                </div>
              }
              rules={[
                { required: true, message: "Nome é obrigatório" },
                { min: 2, message: "Nome deve ter pelo menos 2 caracteres" },
              ]}
            >
              <Input placeholder="Digite seu nome completo" size="large" />
            </Form.Item>

            <Form.Item
              name="email"
              label={
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4" />
                  <span>Email</span>
                </div>
              }
              rules={[
                { required: true, message: "Email é obrigatório" },
                { type: "email", message: "Email inválido" },
              ]}
            >
              <Input placeholder="seu@email.com" size="large" />
            </Form.Item>

            <Form.Item
              name="cpf"
              label={
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>CPF</span>
                </div>
              }
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
          </div>

          <div className="mt-6 pt-4 border-t">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleClose} size="large" className="flex-1">
                Cancelar
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                className="flex-1"
              >
                {loading ? "Processando..." : "Continuar para Pagamento"}
              </Button>
            </div>
            <p className="text-xs text-gray-500 text-center mt-3">
              Você será redirecionado para o Mercado Pago para finalizar o
              pagamento
            </p>
          </div>
        </Form>
      </div>
    </Modal>
  );
}
