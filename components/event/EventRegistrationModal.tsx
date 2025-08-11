"use client";

import { useState } from "react";
import { Modal, Form, message, Steps } from "antd";
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
import { PaymentMethodSelector } from "./PaymentMethodSelector";

// Hook customizado
import { useCpfVerification } from "@/hooks/useCpfVerification";

// Utilitário para tradução dos métodos de pagamento
import { getPaymentMethodName } from "@/utils/paymentMethods";

const { Step } = Steps;

interface EventRegistrationModalProps {
  event: Event;
  open: boolean;
  onClose: () => void;
}

// Tipos para os dados de pagamento
interface PaymentMethodSelection {
  method: string;
  installments?: number;
  totalAmount: number;
  description: string;
}

export default function EventRegistrationModal({
  event,
  open,
  onClose,
}: EventRegistrationModalProps) {
  // Estados principais
  const [loading, setLoading] = useState(false);

  // Estados para controle de etapas
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<RegistrationFormData | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethodSelection | null>(null);

  // Estados para modais
  const [proofModalOpen, setProofModalOpen] = useState(false);

  // Form instance
  const [form] = Form.useForm();

  // Hook de verificação de CPF
  const {
    existingRegistration,
    showExistingOptions,
    handleCpfChange,
    clearCpfVerification,
  } = useCpfVerification();

  // Etapas do processo
  const steps = [
    {
      title: "Dados",
      description: "Informações pessoais",
    },
    {
      title: "Método de pagamento",
      description: "",
    },
    {
      title: "Finalizar inscrição",
      description: "",
    },
  ];

  // Função original simplificada (manter compatibilidade)

  const handleCheckReceipt = () => {
    if (!existingRegistration) return;

    // Abrir modal de comprovante com dados preenchidos
    setProofModalOpen(true);
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

  // Funções de controle de etapas
  const handleNextStep = () => {
    setCurrentStep((current) => current + 1);
  };

  const handlePreviousStep = () => {
    setCurrentStep((current) => current - 1);
  };

  const handleFormSubmit = async (values: RegistrationFormData) => {
    try {
      // Validar dados
      const validatedData = registrationSchema.parse(values);
      setFormData(validatedData);

      // Avançar para seleção de método de pagamento
      handleNextStep();
    } catch (error) {
      if (error instanceof z.ZodError) {
        message.error("Por favor, verifique os dados informados");
      }
    }
  };

  const handlePaymentMethodSelect = (paymentMethod: PaymentMethodSelection) => {
    setSelectedPaymentMethod(paymentMethod);
    handleNextStep();
  };

  const handleFinalSubmit = async () => {
    if (!formData || !selectedPaymentMethod) {
      message.error("Dados incompletos");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/payments/create-preference", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: event.id,
          participantData: formData,
          paymentData: {
            method: selectedPaymentMethod.method,
            installments: selectedPaymentMethod.installments,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao processar pagamento");
      }

      // Redirecionar para MercadoPago
      // A API retorna checkoutUrl (produção) ou sandboxCheckoutUrl (desenvolvimento)
      const redirectUrl = data.checkoutUrl || data.sandboxCheckoutUrl;

      if (redirectUrl) {
        window.location.href = redirectUrl;
        setProofModalOpen(true);
      } else {
        message.error("Erro: Link de pagamento não foi gerado");
      }
    } catch (error) {
      console.error("Erro:", error);
      message.error(
        error instanceof Error ? error.message : "Erro ao processar inscrição"
      );
    } finally {
      setLoading(false);
    }
  };

  // Função original simplificada (manter compatibilidade)
  // Removida pois agora usamos handleFormSubmit e handleFinalSubmit

  const handleCancel = () => {
    form.resetFields();
    clearCpfVerification();
    setProofModalOpen(false);
    setCurrentStep(0);
    setFormData(null);
    setSelectedPaymentMethod(null);
    onClose();
  };

  return (
    <>
      <Modal
        title={
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">
              Inscrição - {event.name}
            </h2>
            <Steps current={currentStep} size="small" className="mb-4">
              {steps.map((step, index) => (
                <Step
                  key={index}
                  title={step.title}
                  description={step.description}
                />
              ))}
            </Steps>
          </div>
        }
        open={open}
        onCancel={handleCancel}
        footer={null}
        width={800}
        destroyOnHidden
      >
        {/* Etapa 0: Dados pessoais */}
        {currentStep === 0 && (
          <div>
            <EventSummary event={event} />

            {showExistingOptions && existingRegistration && (
              <ExistingRegistrationAlert
                registration={existingRegistration}
                onCheckReceipt={handleCheckReceipt}
                onContinuePayment={() => {
                  // TODO: Implementar continuar pagamento pendente
                  clearCpfVerification();
                }}
              />
            )}

            <RegistrationForm
              form={form}
              loading={loading}
              disabled={showExistingOptions}
              onSubmit={handleFormSubmit}
              onCancel={handleCancel}
              onCpfChange={handleCpfChange}
            />
          </div>
        )}

        {/* Etapa 1: Seleção de método de pagamento */}
        {currentStep === 1 && formData && (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Método de Pagamento</h3>
              <p className="text-gray-600">
                Escolha como deseja pagar sua inscrição
              </p>
            </div>

            <PaymentMethodSelector
              eventId={event.id}
              onSelectionChange={(selection) => {
                handlePaymentMethodSelect({
                  method: selection.method,
                  installments: selection.installments,
                  totalAmount: selection.finalValue,
                  description: selection.description,
                });
              }}
            />

            <div className="flex justify-between mt-4">
              <button
                type="button"
                onClick={handlePreviousStep}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Voltar
              </button>
            </div>
          </div>
        )}

        {/* Etapa 2: Confirmação */}
        {currentStep === 2 && formData && selectedPaymentMethod && (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4">
                Confirmação da Inscrição
              </h3>

              {/* Resumo dos dados */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-medium mb-2">Dados Pessoais:</h4>
                <p>
                  <strong>Nome:</strong> {formData.name}
                </p>
                <p>
                  <strong>Email:</strong> {formData.email}
                </p>
                <p>
                  <strong>CPF:</strong> {formData.cpf}
                </p>
                <p>
                  <strong>Telefone:</strong> {formData.phone}
                </p>
              </div>

              {/* Resumo do pagamento */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-medium mb-2">Método de Pagamento:</h4>
                <p>
                  <strong>Método:</strong>{" "}
                  {getPaymentMethodName(selectedPaymentMethod.method)}
                </p>
                {selectedPaymentMethod.installments && (
                  <p>
                    <strong>Parcelas:</strong>{" "}
                    {selectedPaymentMethod.installments}x
                  </p>
                )}
                <p>
                  <strong>Valor Total:</strong>{" "}
                  {selectedPaymentMethod.totalAmount.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={handlePreviousStep}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                disabled={loading}
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <CreditCard className="h-5 w-5 text-white" />
                {loading ? "Processando..." : "Finalizar Inscrição"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Comprovante */}
      <RegistrationProofModal
        open={proofModalOpen}
        onClose={() => setProofModalOpen(false)}
        preloadedData={getProofModalData()}
      />
    </>
  );
}
