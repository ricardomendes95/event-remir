"use client";

import { useState } from "react";
import { Modal, Form, Input, Button, message } from "antd";
import {
  User,
  Mail,
  FileText,
  CreditCard,
  Search,
  Receipt,
} from "lucide-react";
import { Event } from "@/types/event";
import { z } from "zod";

const registrationSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  cpf: z
    .string()
    .regex(
      /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
      "CPF deve estar no formato 000.000.000-00"
    ),
  phone: z
    .string()
    .regex(
      /^\(\d{2}\) \d{4,5}-\d{4}$/,
      "Telefone deve estar no formato (00) 00000-0000"
    ),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

interface ExistingRegistration {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  paymentId: string | null;
  registrationDate: string;
  event: {
    title: string;
    price: number;
    date: string;
    location: string;
  };
}

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
  const [existingRegistration, setExistingRegistration] =
    useState<ExistingRegistration | null>(null);
  const [showExistingOptions, setShowExistingOptions] = useState(false);

  const formatCPF = (value: string) => {
    const cpf = value.replace(/\D/g, "");
    if (cpf.length <= 11) {
      return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return value; // Retorna o valor original se exceder 11 dígitos
  };

  const formatPhone = (value: string) => {
    const phone = value.replace(/\D/g, "");
    if (phone.length <= 10) {
      return phone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    } else if (phone.length === 11) {
      return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    return value; // Retorna o valor original se exceder 11 dígitos
  };

  const checkExistingCpf = async (cpf: string) => {
    try {
      const cleanCpf = cpf.replace(/\D/g, "");

      if (cleanCpf.length !== 11) {
        return; // CPF incompleto, não verificar ainda
      }

      const response = await fetch("/api/registrations/search-by-cpf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cpf: cleanCpf }),
      });

      if (response.status === 404) {
        // CPF não encontrado, pode continuar
        setExistingRegistration(null);
        setShowExistingOptions(false);
        return;
      }

      if (!response.ok) {
        throw new Error("Erro ao verificar CPF");
      }

      const data = await response.json();
      setExistingRegistration(data);
      setShowExistingOptions(true);
    } catch (error) {
      console.error("Erro ao verificar CPF:", error);
      // Não mostrar erro para o usuário, apenas continuar
    }
  };

  const handleContinuePendingPayment = () => {
    if (!existingRegistration?.paymentId) {
      message.error("ID de pagamento não encontrado");
      return;
    }

    // Redirecionar para a página de pagamento pendente
    window.location.href = `/payment/pending?payment_id=${existingRegistration.paymentId}`;
  };

  const handleCheckReceipt = () => {
    if (!existingRegistration) return;

    // Redirecionar para a página de verificação de comprovante
    window.location.href = `/checkin?cpf=${existingRegistration.cpf.replace(
      /\D/g,
      ""
    )}`;
  };

  const handleSubmit = async (values: RegistrationFormData) => {
    try {
      setLoading(true);

      // Se há uma inscrição existente, não permitir nova inscrição
      if (showExistingOptions && existingRegistration) {
        if (existingRegistration.status === "CONFIRMED") {
          message.warning(
            "Este CPF já possui uma inscrição confirmada. Use a opção 'Ver Comprovante' acima."
          );
        } else if (existingRegistration.status === "PENDING") {
          message.warning(
            "Este CPF já possui uma inscrição pendente. Use a opção 'Continuar Pagamento' acima."
          );
        } else {
          message.warning(
            "Este CPF já possui uma inscrição. Verifique as opções acima."
          );
        }
        return;
      }

      // Validação com Zod (agora aceita os valores formatados)
      const validatedData = registrationSchema.parse(values);

      // Transformar os dados para envio na API (removendo formatação)
      const apiData = {
        ...validatedData,
        cpf: validatedData.cpf.replace(/\D/g, ""),
        phone: validatedData.phone.replace(/\D/g, ""),
      };

      // 🎭 MODO MOCKADO: Criar inscrição mockada
      const response = await fetch("/api/payments/create-preference", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: event.id,
          participantData: apiData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao processar inscrição");
      }

      const responseData = await response.json();
      const { checkoutUrl, mockData } = responseData;

      // 🎭 MODO MOCKADO: Mostrar mensagem de sucesso e redirecionar para página de sucesso
      if (mockData) {
        message.success(mockData.message);
        console.log("🎭 Inscrição mockada:", mockData);

        // Aguardar um momento para o usuário ver a mensagem
        setTimeout(() => {
          window.location.href = checkoutUrl;
        }, 1500);
      } else {
        // Redirecionar diretamente para o checkout do Mercado Pago (código real)
        window.location.href = checkoutUrl;
      }
    } catch (error) {
      console.error("Erro na inscrição:", error);

      if (error instanceof z.ZodError) {
        error.issues.forEach((issue) => {
          message.error(issue.message);
        });
      } else {
        message.error(
          error instanceof Error
            ? error.message
            : "Erro ao processar inscrição. Tente novamente."
        );
      }
    } finally {
      setLoading(false);
    }
  };
  const handleClose = () => {
    form.resetFields();
    setExistingRegistration(null);
    setShowExistingOptions(false);
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
      destroyOnHidden
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

        {/* Opções para CPF existente */}
        {showExistingOptions && existingRegistration && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <Search className="h-5 w-5 text-yellow-600 mt-0.5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-800 mb-2">
                  CPF já cadastrado
                </h3>
                <p className="text-sm text-yellow-700 mb-3">
                  Encontramos uma inscrição existente para este CPF:
                </p>

                <div className="bg-white rounded p-3 mb-4 text-sm">
                  <p>
                    <strong>Nome:</strong> {existingRegistration.name}
                  </p>
                  <p>
                    <strong>Email:</strong> {existingRegistration.email}
                  </p>
                  <p>
                    <strong>Status:</strong>
                    <span
                      className={`ml-1 px-2 py-1 rounded text-xs ${
                        existingRegistration.status === "CONFIRMED"
                          ? "bg-green-100 text-green-800"
                          : existingRegistration.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {existingRegistration.status === "CONFIRMED"
                        ? "Confirmado"
                        : existingRegistration.status === "PENDING"
                        ? "Pendente"
                        : "Cancelado"}
                    </span>
                  </p>
                  <p>
                    <strong>Data:</strong>{" "}
                    {new Date(
                      existingRegistration.registrationDate
                    ).toLocaleString("pt-BR")}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  {existingRegistration.status === "CONFIRMED" && (
                    <Button
                      type="primary"
                      icon={<Receipt className="h-4 w-4" />}
                      onClick={handleCheckReceipt}
                      className="w-full"
                    >
                      Ver Comprovante
                    </Button>
                  )}

                  {existingRegistration.status === "PENDING" &&
                    existingRegistration.paymentId && (
                      <Button
                        type="primary"
                        icon={<CreditCard className="h-4 w-4" />}
                        onClick={handleContinuePendingPayment}
                        className="w-full"
                      >
                        Continuar Pagamento
                      </Button>
                    )}
                </div>
              </div>
            </div>
          </div>
        )}

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
              rules={[{ required: true, message: "CPF é obrigatório" }]}
            >
              <Input
                placeholder="000.000.000-00"
                size="large"
                onChange={(e) => {
                  const formatted = formatCPF(e.target.value);
                  form.setFieldValue("cpf", formatted);

                  // Verificar CPF quando estiver completo
                  const cleanCpf = formatted.replace(/\D/g, "");
                  if (cleanCpf.length === 11) {
                    checkExistingCpf(formatted);
                  } else {
                    // Limpar estado se CPF incompleto
                    setExistingRegistration(null);
                    setShowExistingOptions(false);
                  }
                }}
                maxLength={14}
              />
            </Form.Item>

            <Form.Item
              name="phone"
              label="Telefone"
              rules={[{ required: true, message: "Telefone é obrigatório" }]}
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
                disabled={showExistingOptions}
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
