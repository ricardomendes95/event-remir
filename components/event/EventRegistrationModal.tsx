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
import type { DynamicField } from "@/backend/schemas/dynamicFormSchemas";

// Hook customizado
import { useCpfVerification } from "@/hooks/useCpfVerification";
import { useDeviceDetection } from "@/hooks/useDeviceDetection";

import { redirectToPayment } from "@/utils/paymentRedirect";
import { INFINITEPAY_PAYMENT_HINT } from "@/backend/utils/paymentFees";

const { Step } = Steps;

interface EventRegistrationModalProps {
  event: Event;
  open: boolean;
  onClose: () => void;
  initialCpf?: string;
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

  // Configuração de camisa (apenas evento pago com a opção habilitada)
  const shirtConfig =
    !isFreeEvent && event.shirtConfig?.enabled ? event.shirtConfig : null;

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
  // Estados da camisa (evento pago)
  const [wantsShirt, setWantsShirt] = useState(false);
  const [shirtSize, setShirtSize] = useState<string | null>(null);
  const [shirtError, setShirtError] = useState<string | null>(null);

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

  // Etapas do processo - com lógica dinâmica para atualização e eventos gratuitos.
  // No fluxo pago (InfinitePay) o método/parcelas são escolhidos no checkout do
  // gateway, então aqui basta: Dados → Pagamento (valor + ir para o checkout).
  const steps = isUpdatingPayment
    ? [{ title: "Pagamento", description: "Ir para o checkout" }]
    : isFreeEvent
    ? [
        { title: "Dados", description: "Preencha o formulário" },
        { title: "Confirmar inscrição", description: "" },
      ]
    : [
        { title: "Dados", description: "Informações pessoais" },
        { title: "Pagamento", description: "" },
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

  // Submit do formulário BOTH (fixo + dinâmico) — vale para gratuito E pago.
  // Valida o form inteiro (fixos + dinâmicos), separa os dados e avança.
  const handleBothFormsSubmit = async () => {
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
      const schema = isFreeEvent ? freeRegistrationSchema : registrationSchema;
      setFormData(schema.parse(fixed) as RegistrationFormData);
      setDynamicFormData(fixedValues.dynamicFormData ?? null);
      handleNextStep();
    } catch (e) {
      if (e instanceof z.ZodError) {
        message.error("Por favor, verifique os dados informados");
      } else {
        message.error("Por favor, verifique os dados obrigatórios");
      }
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

  const handleFinalSubmit = async () => {
    if (!formData) {
      message.error("Dados incompletos");
      return;
    }

    // Se optou pela camisa, o tamanho é obrigatório
    if (shirtConfig && wantsShirt && !shirtSize) {
      setShirtError("Escolha o tamanho da camisa para continuar");
      message.warning("Escolha o tamanho da camisa para continuar");
      return;
    }
    setShirtError(null);

    setLoading(true);
    let redirectAttempted = false;
    setManualCheckoutUrl(null); // Limpa fallback manual

    try {
      const apiEndpoint = "/api/payments/create-preference";

      // InfinitePay: o método/parcelas são escolhidos no checkout do gateway,
      // então não enviamos paymentData. O valor é recalculado no servidor.
      const requestBody: Record<string, unknown> = {
        eventId: event.id,
        participantData: formData,
        ...(dynamicFormData ? { dynamicFormData } : {}),
        ...(shirtConfig
          ? { wantsShirt, shirtSize: wantsShirt ? shirtSize : null }
          : {}),
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
    setWantsShirt(false);
    setShirtSize(null);
    setShirtError(null);

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
                  onCancel={showDynamic ? undefined! : handleCancel}
                  onCpfChange={handleCpfChange}
                  hideButtons={showDynamic}
                  submitLabel={isFreeEvent ? "Continuar" : undefined}
                />

                {/* BOTH (gratuito ou pago): mostrar também o formulário dinâmico junto */}
                {showDynamic && dynamicFields.length > 0 && (
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
                        onClick={handleBothFormsSubmit}
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

              {/* Seleção de camisa (evento pago com a opção habilitada) */}
              {shirtConfig && !isUpdatingPayment && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-1">Camisa do evento</h3>
                  <p className="text-gray-600 mb-3 text-sm">
                    Escolha sua inscrição. Você vê o valor antes de pagar.
                  </p>

                  <div className="flex flex-col gap-3">
                    {/* Sem camisa */}
                    <button
                      type="button"
                      onClick={() => {
                        setWantsShirt(false);
                        setShirtSize(null);
                        setShirtError(null);
                      }}
                      style={{ minHeight: "56px" }}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 transition ${
                        !wantsShirt
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Inscrição sem camisa</span>
                        <span className="font-bold text-blue-700">
                          {formatCurrency(event.price)}
                        </span>
                      </div>
                    </button>

                    {/* Com camisa */}
                    <button
                      type="button"
                      onClick={() => {
                        setWantsShirt(true);
                        setShirtError(null);
                      }}
                      style={{ minHeight: "56px" }}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 transition ${
                        wantsShirt
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          Inscrição com camisa
                        </span>
                        <span className="font-bold text-blue-700">
                          {formatCurrency(shirtConfig.priceWithShirt)}
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Tamanhos (obrigatório quando com camisa) */}
                  {wantsShirt && (
                    <div className="mt-4">
                      <p className="font-medium mb-2 text-sm">
                        Escolha o tamanho da camisa
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {shirtConfig.sizes.map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => {
                              setShirtSize(size);
                              setShirtError(null);
                            }}
                            style={{ minWidth: "56px", minHeight: "48px" }}
                            className={`px-4 py-2 rounded-lg border-2 font-semibold transition ${
                              shirtSize === size
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-gray-300 bg-white text-gray-700"
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                      {shirtError && (
                        <p className="text-red-600 text-sm mt-2">{shirtError}</p>
                      )}
                    </div>
                  )}

                  <div className="border-t mt-5" />
                </div>
              )}

              {/* Resumo do valor da inscrição */}
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800">
                    Você vai pagar
                  </span>
                  <span className="text-2xl font-extrabold text-blue-700">
                    {formatCurrency(
                      shirtConfig && wantsShirt
                        ? shirtConfig.priceWithShirt
                        : event.price
                    )}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {INFINITEPAY_PAYMENT_HINT}
                </p>
              </div>

              {shirtError && (
                <p className="text-red-600 text-sm mb-3">{shirtError}</p>
              )}

              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <button
                  type="button"
                  onClick={isUpdatingPayment ? handleCancel : handlePreviousStep}
                  disabled={loading}
                  style={{ minHeight: "48px" }}
                  className="px-4 py-3 border border-gray-300 rounded hover:bg-gray-50 w-full sm:w-auto"
                >
                  {isUpdatingPayment ? "Cancelar" : "Voltar"}
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={loading}
                  style={{
                    minHeight: "48px",
                    WebkitTapHighlightColor: "rgba(0,0,0,0.1)",
                  }}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  <div className="flex items-center justify-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    {loading ? "Processando..." : "Ir para o pagamento"}
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
                        textDecoration: "none",
                        color: "white",
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
