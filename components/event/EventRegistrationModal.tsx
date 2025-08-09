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
import { RegistrationProofModal } from "../RegistrationProofModal";

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
  const [showProofModal, setShowProofModal] = useState(false);

  // Hook para verificação de CPF
  const {
    existingRegistration,
    showExistingOptions,
    handleCpfChange,
    clearCpfVerification,
  } = useCpfVerification();

  const handleContinuePendingPayment = async () => {
    if (!existingRegistration) {
      message.error("Dados da inscrição não encontrados");
      return;
    }

    try {
      setLoading(true);

      // Criar nova preferência de pagamento com os dados existentes
      const response = await fetch("/api/payments/create-preference", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: event.id,
          participantData: {
            name: existingRegistration.name,
            email: existingRegistration.email,
            cpf: existingRegistration.cpf.replace(/\D/g, ""),
            phone: existingRegistration.phone.replace(/\D/g, ""),
          },
          registrationId: existingRegistration.id, // Incluir ID da inscrição existente
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao processar pagamento");
      }

      const responseData = await response.json();
      const { checkoutUrl } = responseData;

      // Redirecionar para o checkout do Mercado Pago
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error("Erro ao continuar pagamento:", error);
      message.error(
        error instanceof Error
          ? error.message
          : "Erro ao processar pagamento. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCheckReceipt = () => {
    if (!existingRegistration) return;

    // Abrir modal de comprovante com dados preenchidos
    setShowProofModal(true);
  };

  // Mapear dados da existingRegistration para o formato do RegistrationProofModal
  const getProofModalData = () => {
    if (!existingRegistration) return null;

    return {
      id: existingRegistration.id,
      name: existingRegistration.name,
      email: existingRegistration.email,
      cpf: existingRegistration.cpf,
      phone: existingRegistration.phone,
      status: existingRegistration.status,
      paymentId: existingRegistration.paymentId || "",
      registrationDate: existingRegistration.registrationDate,
      event: {
        title: existingRegistration.event.title,
        price: existingRegistration.event.price,
        date: existingRegistration.event.date,
        location: existingRegistration.event.location,
      },
    };
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
      const { checkoutUrl } = responseData;

      // Redirecionar para o checkout do Mercado Pago
      window.location.href = checkoutUrl;
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
    setShowProofModal(false); // Fechar modal de comprovante também
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

        {/* Modal de Comprovante */}
        <RegistrationProofModal
          open={showProofModal}
          onClose={() => setShowProofModal(false)}
          preloadedData={getProofModalData()}
        />
      </div>
    </Modal>
  );
}
