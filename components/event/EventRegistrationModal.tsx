"use client";

import { useState, useEffect, useRef } from "react";
import { Modal, Form, message, Steps } from "antd";
import { CreditCard, CheckCircle } from "lucide-react";
import { Event } from "@/types/event";
import { z } from "zod";

// Componentes especializados
import {
  EventSummary,
  ExistingRegistrationAlert,
  RegistrationForm,
  DynamicFormRenderer,
  registrationSchema,
  freeRegistrationSchema,
  type RegistrationFormData,
} from "../registration";
import { RegistrationProofModal } from "../RegistrationProofModal";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import type { DynamicField } from "@/backend/schemas/dynamicFormSchemas";

// Hook customizado
import { useCpfVerification } from "@/hooks/useCpfVerification";
import { useDeviceDetection } from "@/hooks/useDeviceDetection";

// Utilitário para tradução dos métodos de pagamento
import { getPaymentMethodName } from "@/utils/paymentMethods";
import { redirectToPayment } from "@/utils/paymentRedirect";

const { Step } = Steps;

interface EventRegistrationModalProps {
  event: Event;
  open: boolean;
  onClose: () => void;
  initialCpf?: string;
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
  initialCpf,
}: EventRegistrationModalProps) {
  // Flags do evento
  const isFreeEvent = !!event.isFree;
  const formMode = event.formMode ?? "FIXED_ONLY";
  const dynamicFields = (event.dynamicFormFields as DynamicField[] | null) ?? [];
  const showFixed = true;
  const showDynamic = formMode !== "FIXED_ONLY";

  const cfg = event.fixedFieldsConfig;
  const emailRequired = isFreeEvent ? !!(cfg?.email?.required) : true;
  const phoneRequired = isFreeEvent ? !!(cfg?.phone?.required) : true;

  // Estados principais
  const [loading, setLoading] = useState(false);
  // Fallback manual para checkout
  const [manualCheckoutUrl, setManualCheckoutUrl] = useState<string | null>(
    null
  );
  // Ref para scroll automático
  const fallbackRef = useRef<HTMLDivElement | null>(null);

  // Scroll automático para o fallback manual
  useEffect(() => {
    if (manualCheckoutUrl && fallbackRef.current) {
      fallbackRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [manualCheckoutUrl]);

  // Estados para controle de etapas
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<RegistrationFormData | null>(null);
  const [dynamicFormData, setDynamicFormData] = useState<Record<string, unknown> | null>(null);
  const [freeRegistrationId, setFreeRegistrationId] = useState<string | null>(null);
  const [freeProofData, setFreeProofData] = useState<Parameters<typeof RegistrationProofModal>[0]["preloadedData"]>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethodSelection | null>(null);

  // Estados para fluxo de atualização - NOVO
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [existingRegistrationId, setExistingRegistrationId] = useState<
    string | null
  >(null);
  // Forçar criação de nova preferência mesmo quando mostramos apenas seleção de método
  const [forceCreateNewPreference, setForceCreateNewPreference] =
    useState(false);

  // Estados para modais
  const [proofModalOpen, setProofModalOpen] = useState(false);

  // Form instance
  const [form] = Form.useForm();

  // Hook de verificação de CPF
  const {
    existingRegistration,
    showExistingOptions,
    isValidatingCpf,
    cpfValidationError,
    handleCpfChange,
    clearCpfVerification,
  } = useCpfVerification(event.id);

  // Hook para detecção de dispositivo
  const deviceInfo = useDeviceDetection();

  // Pré-preencher CPF quando modal abrir
  useEffect(() => {
    if (open && initialCpf) {
      const formatCPF = (value: string) => {
        const cpf = value.replace(/\D/g, "");
        if (cpf.length >= 11) {
          return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        }
        return cpf;
      };

      const formattedCpf = formatCPF(initialCpf);
      form.setFieldValue("cpf", formattedCpf);
      // Trigger CPF validation
      handleCpfChange(formattedCpf);
    }
  }, [open, initialCpf]);

  // Função auxiliar para formatação segura de moeda
  const formatCurrency = (amount: number): string => {
    try {
      // 🆕 NOVO - Instagram iOS sempre usar fallback
      const isInstagramIOS =
        /Instagram/.test(navigator.userAgent) &&
        /iPhone|iPad/.test(navigator.userAgent);

      // Para dispositivos iOS antigos ou Instagram iOS, usar formatação simplificada
      if (deviceInfo.isOldIOS || isInstagramIOS) {
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
    const hasFormData = isFreeEvent
      ? formData && formData.name && formData.cpf
      : formData && formData.name && formData.email && formData.cpf && formData.phone;

    const hasPaymentMethod =
      selectedPaymentMethod &&
      selectedPaymentMethod.method &&
      typeof selectedPaymentMethod.totalAmount === "number";

    if (
      process.env.NODE_ENV === "development" &&
      !navigator.userAgent.includes("Instagram")
    ) {
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

    // Log especial para dispositivos iOS com problemas (não Instagram)
    if (
      deviceInfo.isIOS &&
      currentStep === 2 &&
      !navigator.userAgent.includes("Instagram")
    ) {
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

  // Etapas do processo - com lógica dinâmica para atualização e eventos gratuitos
  const steps = isUpdatingPayment
    ? [
        { title: "Método de pagamento", description: "Escolher novo método" },
        { title: "Confirmar pagamento", description: "" },
      ]
    : isFreeEvent
    ? [
        { title: "Dados", description: "Preencha o formulário" },
        { title: "Confirmar inscrição", description: "" },
      ]
    : [
        { title: "Dados", description: "Informações pessoais" },
        { title: "Método de pagamento", description: "" },
        { title: "Finalizar inscrição", description: "" },
      ];

  // Função original simplificada (manter compatibilidade)

  const handleCheckReceipt = () => {
    if (!existingRegistration) return;

    // Abrir modal de comprovante com dados preenchidos
    setProofModalOpen(true);
  };

  const handleContinuePayment = () => {
    if (!existingRegistration) return;

    // Pré-carregar dados da inscrição existente (campos fixos podem ser null em DYNAMIC_ONLY)
    const existingFormData: RegistrationFormData = {
      name: existingRegistration.name,
      email: existingRegistration.email,
      cpf: existingRegistration.cpf,
      phone: existingRegistration.phone,
    };
    setFormData(existingFormData);

    // Se a inscrição existente está em CANCELLED ou PAYMENT_FAILED, queremos
    // que o usuário apenas escolha o método (mesmo comportamento visual do
    // "continuar pagamento"), mas em backend vamos criar uma NOVA preferência.
    if (
      existingRegistration.status === "CANCELLED" ||
      existingRegistration.status === "PAYMENT_FAILED"
    ) {
      setForceCreateNewPreference(true);
      setIsUpdatingPayment(true); // mostrar apenas seleção de método
      setExistingRegistrationId(null);
    } else {
      // Para PENDING (ou outros que permitimos atualizar), usar o fluxo de update
      setForceCreateNewPreference(false);
      setIsUpdatingPayment(true);
      setExistingRegistrationId(existingRegistration.id);
    }

    // Pular direto para seleção de método de pagamento (step 0 no modo update)
    setCurrentStep(0);

    // Limpar verificação de CPF para remover o alert
    clearCpfVerification();
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
      const schema = isFreeEvent ? freeRegistrationSchema : registrationSchema;
      const validatedData = schema.parse(values);
      setFormData(validatedData as RegistrationFormData);

      if (isFreeEvent) {
        // Para evento gratuito, avançar para confirmação diretamente
        handleNextStep();
      } else {
        // Para evento pago, avançar para seleção de método de pagamento
        handleNextStep();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        message.error("Por favor, verifique os dados informados");
      }
    }
  };

  // Submit gratuito com formulário BOTH (ou DYNAMIC_ONLY, que agora também exibe o form fixo)
  const handleBothFormsFreeSubmit = async () => {
    try {
      const values = await form.validateFields();
      const fixedValues = values as RegistrationFormData & {
        dynamicFormData?: Record<string, unknown>;
      };
      const fixed: RegistrationFormData = {
        name: fixedValues.name,
        email: fixedValues.email,
        cpf: fixedValues.cpf,
        phone: fixedValues.phone,
      };
      setFormData(freeRegistrationSchema.parse(fixed) as RegistrationFormData);
      setDynamicFormData(fixedValues.dynamicFormData ?? null);
      handleNextStep();
    } catch {
      message.error("Por favor, verifique os dados informados");
    }
  };

  // Submit final para eventos gratuitos
  const handleFreeSubmit = async () => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        eventId: event.id,
        fixedData: {
          name: formData!.name,
          email: formData!.email,
          cpf: formData!.cpf,
          phone: formData!.phone,
        },
      };

      if (showDynamic && dynamicFormData) {
        body.dynamicFormData = dynamicFormData;
      }

      const response = await fetch("/api/registrations/create-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao processar inscrição");
      }

      // Buscar comprovante completo para exibir no modal
      const regId: string = data.registration?.id;
      if (regId) {
        setFreeRegistrationId(regId);
        const proofRes = await fetch("/api/registrations/get-by-id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationId: regId }),
        });
        if (proofRes.ok) {
          const proof = await proofRes.json();
          setFreeProofData({
            id: proof.id,
            name: proof.name,
            email: proof.email ?? "",
            cpf: proof.cpf,
            phone: proof.phone ?? "",
            status: proof.status,
            paymentId: proof.paymentId ?? "",
            registrationDate: proof.registrationDate,
            event: {
              title: proof.event.title,
              price: proof.event.price,
              date: proof.event.date,
              location: proof.event.location ?? "",
            },
          });
        }
      }
      setProofModalOpen(true);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "Erro ao processar inscrição"
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentMethodSelect = (paymentMethod: PaymentMethodSelection) => {
    setSelectedPaymentMethod(paymentMethod);

    // Log especial para dispositivos iOS (exceto Instagram)
    if (deviceInfo.isIOS && !navigator.userAgent.includes("Instagram")) {
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
    let redirectAttempted = false;
    setManualCheckoutUrl(null); // Limpa fallback manual

    try {
      const apiEndpoint = "/api/payments/create-preference";

      const requestBody: Record<string, unknown> = {
        eventId: event.id,
        participantData: formData,
        paymentData: {
          method: selectedPaymentMethod.method,
          installments: selectedPaymentMethod.installments,
        },
        ...(dynamicFormData ? { dynamicFormData } : {}),
      };

      // 🆕 NOVO - Fetch com timeout para Instagram iOS
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(apiEndpoint, {
        method: apiEndpoint.includes("update-preference") ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao processar pagamento");
      }

      // Redirecionar para MercadoPago
      const redirectUrl = data.checkoutUrl || data.sandboxCheckoutUrl;

      if (redirectUrl) {
        redirectAttempted = true;
        // 🆕 NOVO - Redirecionamento robusto
        const result = redirectToPayment(redirectUrl);
        // Limpar loading após delay para permitir redirecionamento
        setTimeout(() => {
          setLoading(false);
        }, 2000);

        // Se falhou, exibe fallback manual
        if (result.fallbackNeeded) {
          setManualCheckoutUrl(redirectUrl);
          message.warning(
            "Se a página de pagamento não abrir, clique no botão abaixo ou abra no navegador externo."
          );
        }
      } else {
        message.error("Erro: Link de pagamento não foi gerado");
      }
    } catch (error) {
      console.error("Erro:", error);

      if (error instanceof Error && error.name === "AbortError") {
        message.error("Conexão lenta. Tente novamente.");
      } else {
        message.error(
          error instanceof Error ? error.message : "Erro ao processar inscrição"
        );
      }
    } finally {
      // Só limpar loading se não redirecionou
      if (!redirectAttempted) {
        setLoading(false);
      }
      // Resetar flag após tentativa
      setForceCreateNewPreference(false);
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
    setDynamicFormData(null);
    setFreeRegistrationId(null);
    setFreeProofData(null);
    setSelectedPaymentMethod(null);

    // Reset estados de atualização
    setIsUpdatingPayment(false);
    setExistingRegistrationId(null);

    onClose();
  };

  return (
    <>
      <Modal
        title={
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">
              {isUpdatingPayment
                ? `Continuar Pagamento - ${event.name}`
                : `Inscrição - ${event.name}`}
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
        {/* Etapa 0: Dados pessoais OU Método de pagamento (se updating) */}
        {currentStep === 0 && !isUpdatingPayment && (
          <div>
            <EventSummary event={event} />

            {/* Formulário fixo (sempre obrigatório) + dinâmico quando aplicável */}
            {showFixed && (
              <>
                {showExistingOptions && existingRegistration && (
                  <ExistingRegistrationAlert
                    registration={existingRegistration}
                    onCheckReceipt={handleCheckReceipt}
                    onContinuePayment={handleContinuePayment}
                  />
                )}

                <RegistrationForm
                  form={form}
                  loading={loading}
                  disabled={showExistingOptions}
                  isValidatingCpf={isValidatingCpf}
                  cpfValidationError={cpfValidationError}
                  isFree={isFreeEvent}
                  emailRequired={emailRequired}
                  phoneRequired={phoneRequired}
                  onSubmit={handleFormSubmit}
                  onCancel={isFreeEvent && showDynamic ? undefined! : handleCancel}
                  onCpfChange={handleCpfChange}
                  hideButtons={isFreeEvent && showDynamic}
                  submitLabel={isFreeEvent ? "Continuar" : undefined}
                />

                {/* BOTH gratuito: mostrar também o formulário dinâmico junto */}
                {isFreeEvent && showDynamic && dynamicFields.length > 0 && (
                  <div className="mt-6">
                    <DynamicFormRenderer
                      fields={dynamicFields}
                      form={form}
                      loading={loading}
                      hideButtons
                    />
                    <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={handleBothFormsFreeSubmit}
                        disabled={loading || showExistingOptions}
                        className="flex-1 sm:order-2 px-4 py-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
                      >
                        {loading ? "Processando..." : "Continuar"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="flex-1 sm:order-1 px-4 py-4 border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Etapa 1 (gratuito): Confirmação e submit */}
        {currentStep === 1 && isFreeEvent && !isUpdatingPayment && (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4">Confirmar Inscrição</h3>

              {showFixed && formData && (
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <h4 className="font-medium mb-2">Dados Pessoais:</h4>
                  <p><strong>Nome:</strong> {formData.name}</p>
                  {formData.email && <p><strong>Email:</strong> {formData.email}</p>}
                  <p><strong>CPF:</strong> {formData.cpf}</p>
                  {formData.phone && <p><strong>Telefone:</strong> {formData.phone}</p>}
                </div>
              )}

              {showDynamic && dynamicFormData && (
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <h4 className="font-medium mb-2">Respostas do formulário:</h4>
                  {dynamicFields.map((f) => (
                    <p key={f.id}>
                      <strong>{f.label}:</strong>{" "}
                      {Array.isArray(dynamicFormData[f.id])
                        ? (dynamicFormData[f.id] as string[]).join(", ")
                        : String(dynamicFormData[f.id] ?? "—")}
                    </p>
                  ))}
                </div>
              )}

              <div className="bg-green-50 border border-green-200 p-3 rounded-lg mb-4">
                <p className="text-green-800 font-medium text-sm">
                  Inscrição gratuita — nenhum pagamento necessário.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <button
                type="button"
                onClick={handlePreviousStep}
                disabled={loading}
                className="px-4 py-3 border border-gray-300 rounded hover:bg-gray-50 w-full sm:w-auto"
                style={{ minHeight: "48px" }}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleFreeSubmit}
                disabled={loading}
                className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                style={{ minHeight: "48px" }}
              >
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  {loading ? "Processando..." : "Finalizar Inscrição"}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Etapa 0 (updating) ou 1 (pago): Seleção de método de pagamento */}
        {((currentStep === 0 && isUpdatingPayment) ||
          (currentStep === 1 && !isUpdatingPayment && !isFreeEvent)) &&
          formData && (
            <div>
              {isUpdatingPayment && (
                <div className="mb-6 bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">
                    Dados da Inscrição:
                  </h4>
                  <p className="text-sm text-blue-700">
                    <strong>Nome:</strong> {formData.name} |
                    <strong> CPF:</strong> {formData.cpf} |
                    <strong> Email:</strong> {formData.email}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Os dados pessoais não podem ser alterados. Apenas selecione
                    um novo método de pagamento.
                  </p>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">
                  {isUpdatingPayment
                    ? "Novo Método de Pagamento"
                    : "Método de Pagamento"}
                </h3>
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
                {!isUpdatingPayment && (
                  <button
                    type="button"
                    onClick={handlePreviousStep}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Voltar
                  </button>
                )}
                {isUpdatingPayment && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          )}

        {/* Etapa 1 (updating) ou 2 (normal): Confirmação */}
        {/* Etapa 1 (updating) ou 2 (pago normal): Confirmação + checkout */}
        {((currentStep === 1 && isUpdatingPayment) ||
          (currentStep === 2 && !isUpdatingPayment && !isFreeEvent)) && (
          <div>
            {/* Debug info - remover em produção se necessário */}
            {process.env.NODE_ENV === "development" && (
              <div className="mb-2 p-2 bg-yellow-100 text-xs space-y-1">
                <div>
                  Debug: Step={currentStep}, FormData={!!formData},
                  PaymentMethod={!!selectedPaymentMethod}, IsUpdating=
                  {isUpdatingPayment}
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
                <div className="flex flex-col gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(0)}
                    style={{ minHeight: "48px" }}
                    className="px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 w-full"
                  >
                    Voltar ao Início
                  </button>

                  {formData && !selectedPaymentMethod && (
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      style={{ minHeight: "48px" }}
                      className="px-4 py-3 bg-green-600 text-white rounded hover:bg-green-700 w-full"
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
                      style={{ minHeight: "44px" }}
                      className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm w-full"
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
                    {isUpdatingPayment
                      ? "Confirmar Novo Pagamento"
                      : "Confirmação da Inscrição"}
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

                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <button
                    type="button"
                    onClick={handlePreviousStep}
                    style={{ minHeight: "48px" }}
                    className="px-4 py-3 border border-gray-300 rounded hover:bg-gray-50 w-full sm:w-auto"
                    disabled={loading}
                  >
                    Voltar
                  </button>

                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    disabled={loading || !canShowConfirmationStep()}
                    style={{
                      minHeight: "48px",
                      WebkitTapHighlightColor: "rgba(0,0,0,0.1)",
                    }}
                    className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      {loading ? "Processando..." : "Finalizar Inscrição"}
                    </div>
                  </button>
                </div>

                {/* Fallback manual para iOS/Instagram: exibe botão se redirect falhar */}
                {manualCheckoutUrl && (
                  <div
                    ref={fallbackRef}
                    className="mt-6 p-4 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-lg text-center shadow-lg animate-fade-in"
                  >
                    <p className="mb-3 text-white font-bold text-base drop-shadow">
                      ⚠️ Não foi possível abrir o pagamento automaticamente.
                      <br />
                      Toque no botão abaixo para abrir manualmente.
                      <br />
                      Se não funcionar, copie o link e abra no navegador externo
                      (Safari).
                    </p>
                    <div className="bg-[#015C91] hover:bg-[#2C82B5] rounded-xl px-8 py-4 shadow-2xl border-4 border-white ">
                      <a
                        href={manualCheckoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-white rounded-xl font-extrabold text-xl  "
                        style={{
                          minWidth: 240,
                          letterSpacing: 1,
                          textDecoration: "none", // Remove o sublinhado padrão
                          color: "white", // Respeita a cor definida
                        }}
                      >
                        🚀 Abrir Pagamento Manualmente
                      </a>
                    </div>
                    <div className="mt-3 text-xs break-all text-white/80 select-all">
                      {manualCheckoutUrl}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Modal de Comprovante */}
      <RegistrationProofModal
        open={proofModalOpen}
        onClose={() => {
          setProofModalOpen(false);
          if (freeRegistrationId) handleCancel();
        }}
        preloadedData={freeProofData ?? getProofModalData()}
      />
    </>
  );
}
