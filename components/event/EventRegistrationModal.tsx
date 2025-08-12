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
import { useDeviceDetection } from "@/hooks/useDeviceDetection";

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

  // Hook de detecção de dispositivo
  const deviceInfo = useDeviceDetection();

  // Função auxiliar para formatação segura de moeda
  const formatCurrency = (amount: number): string => {
    try {
      // Para dispositivos iOS antigos, usar formatação simplificada
      if (deviceInfo.isOldIOS) {
        return `R$ ${amount.toFixed(2).replace(".", ",")}`;
      }

      return amount.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    } catch (error) {
      console.warn(
        "Erro na formatação de moeda:",
        error,
        "Amount:",
        amount,
        "Device:",
        deviceInfo
      );
      // Fallback manual para formatação
      return `R$ ${amount.toFixed(2).replace(".", ",")}`;
    }
  };

  // Função para validar se podemos avançar para a etapa de confirmação
  const canShowConfirmationStep = (): boolean => {
    const hasFormData =
      formData &&
      formData.name &&
      formData.email &&
      formData.cpf &&
      formData.phone;

    const hasPaymentMethod =
      selectedPaymentMethod &&
      selectedPaymentMethod.method &&
      typeof selectedPaymentMethod.totalAmount === "number";

    if (process.env.NODE_ENV === "development") {
      console.log("Debug - Validation:", {
        step: currentStep,
        hasFormData,
        hasPaymentMethod,
        formData: formData ? Object.keys(formData) : null,
        paymentMethod: selectedPaymentMethod
          ? Object.keys(selectedPaymentMethod)
          : null,
        device: deviceInfo,
      });
    }

    // Log especial para dispositivos iOS com problemas
    if (deviceInfo.isIOS && currentStep === 2) {
      console.log("iOS Debug - Confirmation Step:", {
        isOldIOS: deviceInfo.isOldIOS,
        browser: deviceInfo.browser,
        formDataValid: !!hasFormData,
        paymentMethodValid: !!hasPaymentMethod,
        formDataContent: formData,
        paymentMethodContent: selectedPaymentMethod,
      });
    }

    return !!(hasFormData && hasPaymentMethod);
  };

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

    // Log especial para dispositivos iOS
    if (deviceInfo.isIOS) {
      console.log("iOS - Payment method selected:", paymentMethod);
    }

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

        {/* Etapa 2: Confirmação - Versão Melhorada */}
        {currentStep === 2 && (
          <div>
            {/* Debug info - remover em produção se necessário */}
            {process.env.NODE_ENV === "development" && (
              <div className="mb-2 p-2 bg-yellow-100 text-xs space-y-1">
                <div>
                  Debug: Step={currentStep}, FormData={!!formData},
                  PaymentMethod={!!selectedPaymentMethod}
                </div>
                {deviceInfo.isIOS && (
                  <div className="text-blue-600">
                    iOS Device - Old: {deviceInfo.isOldIOS ? "Yes" : "No"},
                    Browser: {deviceInfo.browser}
                  </div>
                )}
              </div>
            )}

            {/* Verificação de dados com fallback */}
            {!canShowConfirmationStep() ? (
              <div className="text-center py-8">
                <p className="text-red-600 mb-4">
                  Dados incompletos detectados. Por favor, volte e preencha
                  novamente.
                </p>
                <div className="mb-4 text-sm text-gray-600">
                  <p className="font-medium mb-2">Status dos dados:</p>
                  <div className="space-y-1">
                    <div>
                      Dados pessoais:{" "}
                      {formData ? "✅ Completo" : "❌ Incompleto"}
                    </div>
                    <div>
                      Método de pagamento:{" "}
                      {selectedPaymentMethod ? "✅ Completo" : "❌ Incompleto"}
                    </div>
                    {deviceInfo.isIOS && (
                      <div className="text-blue-600 mt-2">
                        Dispositivo iOS detectado - Versão antiga:{" "}
                        {deviceInfo.isOldIOS ? "Sim" : "Não"}
                      </div>
                    )}
                  </div>
                </div>

                {/* Botões de ação */}
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(0)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Voltar ao Início
                  </button>

                  {formData && !selectedPaymentMethod && (
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Selecionar Pagamento
                    </button>
                  )}

                  {/* Botão de força refresh para iOS problemáticos */}
                  {deviceInfo.isIOS && (
                    <button
                      type="button"
                      onClick={() => {
                        // Force re-render
                        setCurrentStep(2);
                        setTimeout(() => {
                          setCurrentStep(2);
                        }, 100);
                      }}
                      className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-xs"
                    >
                      Recarregar Dados
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-4">
                    Confirmação da Inscrição
                  </h3>

                  {/* Resumo dos dados */}
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <h4 className="font-medium mb-2">Dados Pessoais:</h4>
                    <p>
                      <strong>Nome:</strong> {formData?.name || "Não informado"}
                    </p>
                    <p>
                      <strong>Email:</strong>{" "}
                      {formData?.email || "Não informado"}
                    </p>
                    <p>
                      <strong>CPF:</strong> {formData?.cpf || "Não informado"}
                    </p>
                    <p>
                      <strong>Telefone:</strong>{" "}
                      {formData?.phone || "Não informado"}
                    </p>
                  </div>

                  {/* Resumo do pagamento */}
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <h4 className="font-medium mb-2">Método de Pagamento:</h4>
                    <p>
                      <strong>Método:</strong>{" "}
                      {selectedPaymentMethod?.method
                        ? getPaymentMethodName(selectedPaymentMethod.method)
                        : "Não selecionado"}
                    </p>
                    {selectedPaymentMethod?.installments && (
                      <p>
                        <strong>Parcelas:</strong>{" "}
                        {selectedPaymentMethod.installments}x
                      </p>
                    )}
                    <p>
                      <strong>Valor Total:</strong>{" "}
                      {formatCurrency(selectedPaymentMethod?.totalAmount || 0)}
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
                    disabled={loading || !canShowConfirmationStep()}
                    className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <CreditCard className="h-5 w-5 text-white" />
                    {loading ? "Processando..." : "Finalizar Inscrição"}
                  </button>
                </div>
              </>
            )}
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
