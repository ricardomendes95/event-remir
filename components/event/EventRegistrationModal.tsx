"use client";

import { useState, useEffect, useRef } from "react";
import { Modal, Form, message, Steps, type FormInstance } from "antd";
import { CreditCard, CheckCircle, AlertCircle } from "lucide-react";
import { Event } from "@/types/event";
import { z } from "zod";

// Componentes especializados
import {
  EventSummary,
  ExistingRegistrationAlert,
  RegistrationForm,
  DynamicFormRenderer,
  BatchParticipantsSection,
  BatchOrderSummary,
  batchTotal,
  GroupProofModal,
  registrationSchema,
  freeRegistrationSchema,
  type RegistrationFormData,
  type BatchExtra,
  type BatchOrderPerson,
  type GroupProofData,
} from "../registration";
import { ShirtPhoto } from "@/components/registration/ShirtPhoto";
import { RegistrationProofModal } from "../RegistrationProofModal";
import type { DynamicField } from "@/backend/schemas/dynamicFormSchemas";

// Hook customizado
import { useCpfVerification } from "@/hooks/useCpfVerification";
import { useDeviceDetection } from "@/hooks/useDeviceDetection";

import { redirectToPayment } from "@/utils/paymentRedirect";
import { INFINITEPAY_PAYMENT_HINT } from "@/backend/utils/paymentFees";
import { MAX_BATCH_SIZE } from "@/backend/schemas/batchRegistrationSchemas";

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
  const dynamicFields =
    (event.dynamicFormFields as DynamicField[] | null) ?? [];
  const showFixed = true;
  const showDynamic = formMode !== "FIXED_ONLY";

  const cfg = event.fixedFieldsConfig;
  const emailRequired = isFreeEvent ? !!cfg?.email?.required : true;
  const phoneRequired = isFreeEvent ? !!cfg?.phone?.required : true;

  // Configuração de camisa (apenas evento pago com a opção habilitada)
  const shirtConfig =
    !isFreeEvent && event.shirtConfig?.enabled ? event.shirtConfig : null;

  // Inscrição em grupo (vários participantes numa mesma compra)
  const batchAllowed = !!event.allowBatchRegistration;

  // Estados principais
  const [loading, setLoading] = useState(false);
  // Fallback manual para checkout
  const [manualCheckoutUrl, setManualCheckoutUrl] = useState<string | null>(
    null,
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
  const [dynamicFormData, setDynamicFormData] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [freeRegistrationId, setFreeRegistrationId] = useState<string | null>(
    null,
  );
  const [freeProofData, setFreeProofData] =
    useState<Parameters<typeof RegistrationProofModal>[0]["preloadedData"]>(
      null,
    );
  // Estados da camisa (evento pago)
  const [wantsShirt, setWantsShirt] = useState(false);
  const [shirtSize, setShirtSize] = useState<string | null>(null);
  const [shirtError, setShirtError] = useState<string | null>(null);

  // Estados para fluxo de atualização - NOVO
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [existingRegistrationId, setExistingRegistrationId] = useState<
    string | null
  >(null);

  // A camisa pode ser reescolhida enquanto a inscrição não foi paga.
  const canChooseShirt = !!shirtConfig;

  // Estados para modais
  const [proofModalOpen, setProofModalOpen] = useState(false);

  // Estados da compra em grupo: o responsável é o formulário principal; as
  // demais pessoas ficam em `extras` (cada uma com o próprio formulário).
  const [batchEnabled, setBatchEnabled] = useState(false);
  const [extras, setExtras] = useState<BatchExtra[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [errorKeys, setErrorKeys] = useState<string[]>([]);
  const [batchErrorLines, setBatchErrorLines] = useState<
    { key: string; text: string }[]
  >([]);
  const [shirtErrors, setShirtErrors] = useState<Record<string, string>>({});
  const [retryOrderId, setRetryOrderId] = useState<string | null>(null);
  const [groupProof, setGroupProof] = useState<GroupProofData | null>(null);
  const [groupActionLoading, setGroupActionLoading] = useState(false);
  const [pendingFieldErrors, setPendingFieldErrors] = useState<
    { key: string; field: string; message: string }[]
  >([]);
  const extraFormsRef = useRef<Record<string, FormInstance>>({});
  const batchActive =
    batchAllowed && batchEnabled && extras.length > 0 && !isUpdatingPayment;

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
        deviceInfo,
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

  const redirectToCheckout = (redirectUrl: string) => {
    const result = redirectToPayment(redirectUrl);
    // Limpar loading após delay para permitir redirecionamento
    setTimeout(() => {
      setLoading(false);
      setGroupActionLoading(false);
    }, 2000);

    if (result.fallbackNeeded) {
      setManualCheckoutUrl(redirectUrl);
      message.warning(
        "Se a página de pagamento não abrir, clique no botão abaixo ou abra no navegador externo.",
      );
    }
  };

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

    setShirtError(null);
    setIsUpdatingPayment(true);

    if (
      existingRegistration.status === "CANCELLED" ||
      existingRegistration.status === "PAYMENT_FAILED"
    ) {
      setExistingRegistrationId(null);

      // Nova tentativa: o participante escolhe a camisa do zero.
      setWantsShirt(false);
      setShirtSize(null);
    } else {
      setExistingRegistrationId(existingRegistration.id);

      // Pré-seleciona a escolha atual, que o participante ainda pode alterar
      // antes de pagar — é ela que define o valor cobrado.
      setWantsShirt(existingRegistration.wantsShirt);
      setShirtSize(existingRegistration.shirtSize);
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


  // ---------------------------------------------------------------------
  // Compra em grupo
  // ---------------------------------------------------------------------
  const newExtra = (): BatchExtra => ({
    key: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    values: {},
    wantsShirt: false,
    shirtSize: null,
  });

  const extraHasData = (key: string) => {
    const v = extraFormsRef.current[key]?.getFieldsValue(true) as
      | Record<string, unknown>
      | undefined;
    return !!v && Object.values(v).some((x) => !!x && String(x).trim() !== "");
  };

  const confirmIfFilled = (removed: BatchExtra[], onOk: () => void) => {
    if (removed.some((e) => extraHasData(e.key))) {
      Modal.confirm({
        title: "Remover os dados já preenchidos?",
        content:
          removed.length > 1
            ? "As últimas pessoas já têm dados digitados e eles serão apagados."
            : "Esta pessoa já tem dados digitados e eles serão apagados.",
        okText: "Remover",
        cancelText: "Manter",
        onOk,
      });
    } else {
      onOk();
    }
  };

  const clearBatchFeedback = () => {
    setErrorKeys([]);
    setBatchErrorLines([]);
    setShirtErrors({});
    setPendingFieldErrors([]);
  };

  const handleBatchEnabledChange = (enabled: boolean) => {
    clearBatchFeedback();
    if (enabled) {
      const first = newExtra();
      setExtras([first]);
      setOpenKey(first.key);
      setBatchEnabled(true);
    } else {
      confirmIfFilled(extras, () => {
        setBatchEnabled(false);
        setExtras([]);
        setOpenKey(null);
        setRetryOrderId(null);
      });
    }
  };

  const handleBatchCountChange = (count: number) => {
    const target = Math.min(MAX_BATCH_SIZE, Math.max(2, count));
    const wanted = target - 1;
    if (wanted === extras.length) return;
    if (wanted > extras.length) {
      const added = Array.from({ length: wanted - extras.length }, newExtra);
      setExtras((prev) => [...prev, ...added]);
      setOpenKey(added[0].key);
    } else {
      confirmIfFilled(extras.slice(wanted), () => {
        setExtras((prev) => prev.slice(0, wanted));
        setOpenKey(null);
      });
    }
  };

  const handleRemoveExtra = (key: string) => {
    const target = extras.find((e) => e.key === key);
    if (!target) return;
    confirmIfFilled([target], () => {
      setExtras((prev) => prev.filter((e) => e.key !== key));
      setOpenKey(null);
    });
  };

  const handleRegisterExtraForm = (key: string, f: FormInstance | null) => {
    if (f) extraFormsRef.current[key] = f;
    else delete extraFormsRef.current[key];
  };

  const personLabel = (key: string, mainName?: string) => {
    if (key === "main") return `Pessoa 1 (${mainName || "responsável"})`;
    const i = extras.findIndex((e) => e.key === key);
    const name = String(
      extraFormsRef.current[key]?.getFieldValue("name") ??
        extras[i]?.values.name ??
        "",
    ).trim();
    return `Pessoa ${i + 2}${name ? ` (${name})` : ""}`;
  };

  // Valida o formulário principal + o de cada pessoa adicional. Serve também ao
  // evento sem lote (extras vazio), no lugar do submit "BOTH".
  const handleContinue = async () => {
    clearBatchFeedback();
    const schema = isFreeEvent ? freeRegistrationSchema : registrationSchema;
    const failedKeys: string[] = [];
    const lines: { key: string; text: string }[] = [];

    let mainValues:
      | (RegistrationFormData & { dynamicFormData?: Record<string, unknown> })
      | null = null;
    try {
      mainValues = await form.validateFields();
    } catch {
      failedKeys.push("main");
    }

    const collected: BatchExtra[] = [];
    if (batchActive) {
      for (const ex of extras) {
        const f = extraFormsRef.current[ex.key];
        try {
          const values = (await f.validateFields()) as Record<string, unknown>;
          schema.parse({
            name: values.name,
            email: values.email,
            cpf: values.cpf,
            phone: values.phone,
          });
          collected.push({ ...ex, values });
        } catch {
          failedKeys.push(ex.key);
        }
      }

      // CPF repetido entre as pessoas da mesma compra
      const seen = new Map<string, string>();
      const entries: [string, FormInstance][] = [
        ["main", form],
        ...extras.map((e) => [e.key, extraFormsRef.current[e.key]] as [string, FormInstance]),
      ];
      for (const [key, f] of entries) {
        const digits = String(f?.getFieldValue("cpf") ?? "").replace(/\D/g, "");
        if (digits.length !== 11) continue;
        if (seen.has(digits)) {
          f.setFields([
            {
              name: "cpf",
              errors: [
                `Este CPF já foi informado para ${personLabel(seen.get(digits)!)}`,
              ],
            },
          ]);
          if (!failedKeys.includes(key)) failedKeys.push(key);
        } else {
          seen.set(digits, key);
        }
      }
    }

    if (failedKeys.length > 0 || !mainValues) {
      for (const key of failedKeys) {
        lines.push({
          key,
          text: `${personLabel(key, String(form.getFieldValue("name") ?? ""))}: confira os campos em vermelho`,
        });
      }
      setErrorKeys(failedKeys);
      setBatchErrorLines(batchActive ? lines : []);
      const firstExtra = failedKeys.find((k) => k !== "main");
      if (failedKeys.includes("main")) {
        document
          .getElementById("registration-top")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (firstExtra) {
        setOpenKey(firstExtra);
      }
      message.error("Por favor, verifique os dados informados");
      return;
    }

    try {
      const fixed: RegistrationFormData = {
        name: mainValues.name,
        email: mainValues.email,
        cpf: mainValues.cpf,
        phone: mainValues.phone,
      };
      setFormData(schema.parse(fixed) as RegistrationFormData);
      setDynamicFormData(mainValues.dynamicFormData ?? null);
      if (batchActive) setExtras(collected);
      handleNextStep();
    } catch {
      message.error("Por favor, verifique os dados informados");
    }
  };

  const batchPeople = (): BatchOrderPerson[] => [
    {
      key: "main",
      name: formData?.name ?? "",
      isResponsible: true,
      wantsShirt,
      shirtSize,
      error: shirtErrors.main,
    },
    ...extras.map((e) => ({
      key: e.key,
      name: String(e.values.name ?? ""),
      isResponsible: false,
      wantsShirt: e.wantsShirt,
      shirtSize: e.shirtSize,
      error: shirtErrors[e.key],
    })),
  ];

  const handleBatchShirtChange = (
    key: string,
    wants: boolean,
    size: string | null,
  ) => {
    setShirtErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (key === "main") {
      setWantsShirt(wants);
      setShirtSize(wants ? size : null);
    } else {
      setExtras((prev) =>
        prev.map((e) =>
          e.key === key
            ? { ...e, wantsShirt: wants, shirtSize: wants ? size : null }
            : e,
        ),
      );
    }
  };

  const participantPayload = (
    fixed: { name?: string; email?: string; cpf?: string; phone?: string },
    dynamic: Record<string, unknown> | null | undefined,
  ) => ({
    name: fixed.name,
    email: fixed.email,
    cpf: fixed.cpf,
    phone: fixed.phone,
    ...(showDynamic && dynamic ? { dynamicFormData: dynamic } : {}),
  });

  // Erros por participante devolvidos pelo servidor ({ index, field, message }).
  // 0 = responsável; 1.. = extras. Camisa fica na etapa de pagamento; o resto
  // volta para a etapa de dados e marca o campo exato no cartão certo.
  const applyServerErrors = (
    errors: { index: number; field: string; message: string }[],
  ) => {
    const keyOf = (index: number) =>
      index === 0 ? "main" : (extras[index - 1]?.key ?? "main");
    const shirt: Record<string, string> = {};
    const fieldErrors: { key: string; field: string; message: string }[] = [];
    const lines: { key: string; text: string }[] = [];
    const keys = new Set<string>();

    for (const err of errors) {
      const key = keyOf(err.index);
      if (err.field === "shirtSize" || err.field === "wantsShirt") {
        shirt[key] = err.message;
        continue;
      }
      fieldErrors.push({ key, field: err.field, message: err.message });
      keys.add(key);
      lines.push({
        key,
        text: `${personLabel(key, formData?.name)}: ${err.message}`,
      });
    }

    setShirtErrors(shirt);
    if (fieldErrors.length === 0) return;

    setErrorKeys([...keys]);
    setBatchErrorLines(lines);
    setPendingFieldErrors(fieldErrors);
    const firstExtra = [...keys].find((k) => k !== "main");
    setOpenKey(keys.has("main") ? null : (firstExtra ?? null));
    setCurrentStep(0);
  };

  // Aplica os erros do servidor depois que a etapa de dados remontou.
  useEffect(() => {
    if (currentStep !== 0 || pendingFieldErrors.length === 0) return;
    const t = setTimeout(() => {
      for (const err of pendingFieldErrors) {
        const f = err.key === "main" ? form : extraFormsRef.current[err.key];
        if (!f) continue;
        const name = err.field.startsWith("dynamicFormData.")
          ? ["dynamicFormData", err.field.slice("dynamicFormData.".length)]
          : err.field;
        f.setFields([{ name, errors: [err.message] }]);
      }
      setPendingFieldErrors([]);
      document
        .getElementById("batch-errors")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return () => clearTimeout(t);
  }, [currentStep, pendingFieldErrors, form]);

  const readJson = async (response: Response) => {
    try {
      return await response.json();
    } catch {
      return {};
    }
  };

  const handleBatchPaidSubmit = async () => {
    if (!formData) {
      message.error("Dados incompletos");
      return;
    }

    const people = batchPeople();
    if (shirtConfig) {
      const missing: Record<string, string> = {};
      for (const p of people) {
        if (p.wantsShirt && !p.shirtSize) {
          missing[p.key] = "Escolha o tamanho da camisa";
        }
      }
      if (Object.keys(missing).length > 0) {
        setShirtErrors(missing);
        message.warning("Escolha o tamanho da camisa de cada pessoa");
        return;
      }
    }
    setShirtErrors({});

    setLoading(true);
    let redirectAttempted = false;
    setManualCheckoutUrl(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      // Pedido já criado (gateway falhou antes): só gera um novo link.
      const response = retryOrderId
        ? await fetch("/api/payments/update-batch-preference", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: retryOrderId }),
            signal: controller.signal,
          })
        : await fetch("/api/payments/create-batch-preference", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId: event.id,
              participants: [
                {
                  ...participantPayload(formData, dynamicFormData),
                  ...(shirtConfig
                    ? { wantsShirt, shirtSize: wantsShirt ? shirtSize : null }
                    : {}),
                },
                ...extras.map((e) => ({
                  ...participantPayload(
                    e.values as { name?: string; email?: string; cpf?: string; phone?: string },
                    e.values.dynamicFormData as Record<string, unknown> | undefined,
                  ),
                  ...(shirtConfig
                    ? {
                        wantsShirt: e.wantsShirt,
                        shirtSize: e.wantsShirt ? e.shirtSize : null,
                      }
                    : {}),
                })),
              ],
            }),
            signal: controller.signal,
          });

      clearTimeout(timeoutId);
      const body = await readJson(response);

      if (!response.ok) {
        if (Array.isArray(body.errors) && body.errors.length > 0) {
          applyServerErrors(body.errors);
          message.error(
            body.error ?? "Corrija os dados destacados para continuar",
          );
          return;
        }
        if (response.status === 502 && body.data?.orderId) {
          setRetryOrderId(body.data.orderId);
          message.error(
            "Sua compra foi registrada, mas o pagamento não abriu. Toque em \"Ir para o pagamento\" para tentar de novo.",
          );
          return;
        }
        throw new Error(body.error || "Erro ao processar pagamento");
      }

      const checkoutUrl: string | undefined = body.data?.checkoutUrl;
      if (checkoutUrl) {
        redirectAttempted = true;
        redirectToCheckout(checkoutUrl);
      } else {
        message.error("Erro: Link de pagamento não foi gerado");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        message.error("Conexão lenta. Tente novamente.");
      } else {
        message.error(
          error instanceof Error ? error.message : "Erro ao processar inscrição",
        );
      }
    } finally {
      if (!redirectAttempted) setLoading(false);
    }
  };

  const handleBatchFreeSubmit = async () => {
    if (!formData) {
      message.error("Dados incompletos");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/registrations/create-free-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          participants: [
            participantPayload(formData, dynamicFormData),
            ...extras.map((e) =>
              participantPayload(
                e.values as { name?: string; email?: string; cpf?: string; phone?: string },
                e.values.dynamicFormData as Record<string, unknown> | undefined,
              ),
            ),
          ],
        }),
      });
      const body = await readJson(response);

      if (!response.ok) {
        if (Array.isArray(body.errors) && body.errors.length > 0) {
          applyServerErrors(body.errors);
          message.error(
            body.error ?? "Corrija os dados destacados para continuar",
          );
          return;
        }
        throw new Error(body.error || "Erro ao processar inscrição");
      }

      setGroupProof({
        eventTitle: body.data?.eventTitle ?? event.name,
        status: "CONFIRMED",
        totalValue: null,
        participants: body.data?.registrations ?? [],
      });
      setFreeRegistrationId(body.data?.registrations?.[0]?.id ?? "group");
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "Erro ao processar inscrição",
      );
    } finally {
      setLoading(false);
    }
  };

  // Pedido pendente em grupo: continuar o pagamento do grupo todo.
  const handleContinueOrder = async () => {
    const orderId = existingRegistration?.order?.id;
    if (!orderId) return;
    setGroupActionLoading(true);
    setManualCheckoutUrl(null);
    let redirected = false;
    try {
      const response = await fetch("/api/payments/update-batch-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const body = await readJson(response);
      if (!response.ok || !body.data?.checkoutUrl) {
        throw new Error(body.error || "Não foi possível abrir o pagamento");
      }
      redirected = true;
      redirectToCheckout(body.data.checkoutUrl);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "Erro ao abrir o pagamento",
      );
    } finally {
      if (!redirected) setGroupActionLoading(false);
    }
  };

  // Sair do grupo e seguir sozinho: o servidor recalcula o pedido para quem
  // fica; depois a pessoa continua pelo fluxo individual de "continuar pagamento".
  const handleLeaveOrder = () => {
    if (!existingRegistration) return;
    const registration = existingRegistration;
    Modal.confirm({
      title: "Sair do grupo?",
      content:
        "Você deixa de fazer parte desta compra e passa a pagar só a sua inscrição. O valor do grupo é recalculado para as outras pessoas.",
      okText: "Sair e pagar sozinho",
      cancelText: "Voltar",
      onOk: async () => {
        setGroupActionLoading(true);
        try {
          const response = await fetch(
            `/api/registrations/${registration.id}/leave-order`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cpf: registration.cpf.replace(/\D/g, "") }),
            },
          );
          const body = await readJson(response);
          if (!response.ok) {
            throw new Error(body.error || "Não foi possível sair do grupo");
          }
          message.success("Pronto, você saiu do grupo. Agora é só pagar a sua inscrição.");
          handleContinuePayment();
        } catch (error) {
          message.error(
            error instanceof Error ? error.message : "Erro ao sair do grupo",
          );
        } finally {
          setGroupActionLoading(false);
        }
      },
    });
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
        error instanceof Error ? error.message : "Erro ao processar inscrição",
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
        method: "POST",
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

      // Redirecionar para o checkout do gateway
      const redirectUrl = data.checkoutUrl;

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
            "Se a página de pagamento não abrir, clique no botão abaixo ou abra no navegador externo.",
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
          error instanceof Error
            ? error.message
            : "Erro ao processar inscrição",
        );
      }
    } finally {
      // Só limpar loading se não redirecionou
      if (!redirectAttempted) {
        setLoading(false);
      }
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

    // Reset da compra em grupo
    setBatchEnabled(false);
    setExtras([]);
    setOpenKey(null);
    clearBatchFeedback();
    setRetryOrderId(null);
    setGroupProof(null);
    setManualCheckoutUrl(null);
    extraFormsRef.current = {};

    onClose();
  };

  // Fallback manual para iOS/Instagram: exibe botão se o redirect falhar
  const manualFallbackBlock = (
    <>
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
    </>
  );

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
        maskClosable={!batchEnabled}
      >
        {/* Etapa 0: Dados pessoais OU Método de pagamento (se updating) */}
        {currentStep === 0 && !isUpdatingPayment && (
          <div id="registration-top">
            <EventSummary event={event} />

            {/* Formulário fixo (sempre obrigatório) + dinâmico quando aplicável */}
            {showFixed && (
              <>
                {showExistingOptions && existingRegistration && (
                  <ExistingRegistrationAlert
                    registration={existingRegistration}
                    onCheckReceipt={handleCheckReceipt}
                    onContinuePayment={handleContinuePayment}
                    onContinueOrder={handleContinueOrder}
                    onLeaveOrder={handleLeaveOrder}
                    groupLoading={groupActionLoading}
                  />
                )}
                {showExistingOptions && manualFallbackBlock}

                {batchAllowed && batchEnabled && (
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-blue-800">
                    <span className="px-2 py-1 bg-blue-100 rounded">
                      Pessoa 1
                    </span>
                    Responsável pela compra
                    {errorKeys.includes("main") && (
                      <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                        Corrigir
                      </span>
                    )}
                  </div>
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
                  hideButtons={showDynamic || batchAllowed}
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
                  </div>
                )}

                {batchAllowed && !showExistingOptions && (
                  <BatchParticipantsSection
                    enabled={batchEnabled}
                    onEnabledChange={handleBatchEnabledChange}
                    count={extras.length + 1}
                    onCountChange={handleBatchCountChange}
                    extras={extras}
                    openKey={openKey}
                    onOpenKeyChange={setOpenKey}
                    errorKeys={errorKeys}
                    isFree={isFreeEvent}
                    emailRequired={emailRequired}
                    phoneRequired={phoneRequired}
                    dynamicFields={dynamicFields}
                    showDynamic={showDynamic}
                    mainForm={form}
                    onRegisterForm={handleRegisterExtraForm}
                    onRemoveExtra={handleRemoveExtra}
                  />
                )}

                {batchErrorLines.length > 0 && (
                  <div
                    id="batch-errors"
                    role="alert"
                    className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <p className="flex items-center gap-2 font-medium text-red-800 mb-2">
                      <AlertCircle className="h-4 w-4" />
                      Corrija os dados destacados para continuar
                    </p>
                    <ul className="space-y-1">
                      {batchErrorLines.map((line, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => {
                              if (line.key === "main") {
                                document
                                  .getElementById("registration-top")
                                  ?.scrollIntoView({ behavior: "smooth" });
                              } else {
                                setOpenKey(line.key);
                              }
                            }}
                            className="text-sm text-red-700 underline text-left"
                          >
                            {line.text}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {((showDynamic && dynamicFields.length > 0) || batchAllowed) && (
                  <div>
                    <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={batchAllowed ? handleContinue : handleBothFormsSubmit}
                        disabled={loading || showExistingOptions}
                        className="flex-1 sm:order-2 px-4 py-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
                      >
                        {loading
                          ? "Processando..."
                          : batchActive
                            ? `Continuar com ${extras.length + 1} pessoas`
                            : "Continuar"}
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
        {currentStep === 1 && isFreeEvent && !isUpdatingPayment && !batchActive && (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4">Confirmar Inscrição</h3>

              {showFixed && formData && (
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <h4 className="font-medium mb-2">Dados Pessoais:</h4>
                  <p>
                    <strong>CPF:</strong> {formData.cpf}
                  </p>
                  <p>
                    <strong>Nome:</strong> {formData.name}
                  </p>
                  {formData.email && (
                    <p>
                      <strong>Email:</strong> {formData.email}
                    </p>
                  )}
                  {formData.phone && (
                    <p>
                      <strong>Telefone:</strong> {formData.phone}
                    </p>
                  )}
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
        {/* Compra em grupo (gratuita): conferência das pessoas */}
        {currentStep === 1 && batchActive && isFreeEvent && formData && (
          <div data-testid="batch-free-confirm">
            <h3 className="text-lg font-medium mb-1">
              Confirmar {extras.length + 1} inscrições
            </h3>
            <p className="text-gray-600 mb-4 text-sm">
              Confira as pessoas. Todas serão inscritas de uma vez.
            </p>
            <ul className="space-y-2 mb-4">
              {[
                { key: "main", name: formData.name, cpf: formData.cpf },
                ...extras.map((e) => ({
                  key: e.key,
                  name: String(e.values.name ?? ""),
                  cpf: String(e.values.cpf ?? ""),
                })),
              ].map((p, i) => (
                <li key={p.key} className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">
                    Pessoa {i + 1}
                    {i === 0 && " · Responsável pela compra"}
                  </p>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-gray-600">CPF {p.cpf}</p>
                </li>
              ))}
            </ul>
            <div className="bg-green-50 border border-green-200 p-3 rounded-lg mb-4">
              <p className="text-green-800 font-medium text-sm">
                Inscrições gratuitas — nenhum pagamento necessário.
              </p>
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
                onClick={handleBatchFreeSubmit}
                disabled={loading}
                className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                style={{ minHeight: "56px" }}
              >
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  {loading
                    ? "Processando..."
                    : `Finalizar ${extras.length + 1} inscrições`}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Compra em grupo (paga): camisa por pessoa + total */}
        {currentStep === 1 && batchActive && !isFreeEvent && formData && (
          <div>
            <BatchOrderSummary
              people={batchPeople()}
              shirtConfig={shirtConfig}
              basePrice={event.price}
              batchName={event.activeBatch?.name}
              formatCurrency={formatCurrency}
              onShirtChange={handleBatchShirtChange}
            />
            <div className="sticky bottom-0 bg-white pt-3 pb-1 flex flex-col sm:flex-row justify-between gap-3">
              <button
                type="button"
                onClick={handlePreviousStep}
                disabled={loading}
                style={{ minHeight: "48px" }}
                className="px-4 py-3 border border-gray-300 rounded hover:bg-gray-50 w-full sm:w-auto"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleBatchPaidSubmit}
                disabled={loading}
                style={{
                  minHeight: "56px",
                  WebkitTapHighlightColor: "rgba(0,0,0,0.1)",
                }}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                <div className="flex items-center justify-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {loading
                    ? "Processando..."
                    : `Ir para o pagamento · ${formatCurrency(
                        batchTotal(
                          batchPeople(),
                          event.price,
                          shirtConfig ? shirtConfig.priceWithShirt : null,
                        ),
                      )}`}
                </div>
              </button>
            </div>
            {manualFallbackBlock}
          </div>
        )}

        {((currentStep === 0 && isUpdatingPayment) ||
          (currentStep === 1 &&
            !isUpdatingPayment &&
            !isFreeEvent &&
            !batchActive)) &&
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
                    Os dados pessoais não podem ser alterados.
                  </p>
                </div>
              )}

              {/* Seleção de camisa (evento pago com a opção habilitada) */}
              {canChooseShirt && shirtConfig && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-1">Camisa do evento</h3>
                  <p className="text-gray-600 mb-3 text-sm">
                    {isUpdatingPayment
                      ? "Você pode alterar sua escolha antes de pagar."
                      : "Escolha sua inscrição. Você vê o valor antes de pagar."}
                  </p>

                  {shirtConfig.imageUrl && (
                    <div className="mb-3">
                      <ShirtPhoto src={shirtConfig.imageUrl} size="md" />
                    </div>
                  )}

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
                        <span className="font-medium">
                          Inscrição sem camisa
                        </span>
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
                        <p className="text-red-600 text-sm mt-2">
                          {shirtError}
                        </p>
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
                    {event.activeBatch && (
                      <span className="block text-sm font-normal text-gray-600">
                        {event.activeBatch.name}
                      </span>
                    )}
                  </span>
                  <span className="text-2xl font-extrabold text-blue-700">
                    {formatCurrency(
                      shirtConfig && wantsShirt
                        ? shirtConfig.priceWithShirt
                        : event.price,
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
                  onClick={
                    isUpdatingPayment ? handleCancel : handlePreviousStep
                  }
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

              {manualFallbackBlock}
            </div>
          )}
      </Modal>

      {/* Comprovante consolidado da compra em grupo */}
      <GroupProofModal
        open={!!groupProof}
        onClose={handleCancel}
        data={groupProof}
      />

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
