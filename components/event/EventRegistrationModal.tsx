"use client";

import { useState } from "react";
import { Modal, Form, message } from "antd";
import { CreditCard } from "lucide-react";
import { Event } from "@/types/event";
import { z } from "zod";

// Componentes especializados
import {
  EventSummary,
  ExistingRegistrationAlert,
  RegistrationForm,
  registrationSchema,
  type RegistrationFormData,
} from "../registration";

// Hook customizado
import { useCpfVerification } from "@/hooks/useCpfVerification";

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

  // Hook para verificação de CPF
  const {
    existingRegistration,
    showExistingOptions,
    handleCpfChange,
    clearCpfVerification,
  } = useCpfVerification();

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
    clearCpfVerification();
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
        <EventSummary event={event} />

        {/* Opções para CPF existente */}
        {showExistingOptions && existingRegistration && (
          <ExistingRegistrationAlert
            registration={existingRegistration}
            onCheckReceipt={handleCheckReceipt}
            onContinuePayment={handleContinuePendingPayment}
          />
        )}

        {/* Formulário */}
        <RegistrationForm
          form={form}
          loading={loading}
          disabled={showExistingOptions}
          onSubmit={handleSubmit}
          onCancel={handleClose}
          onCpfChange={handleCpfChange}
        />
      </div>
    </Modal>
  );
}
