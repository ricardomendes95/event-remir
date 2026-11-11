"use client";

import { useEffect, useRef } from "react";
import { Form, FormInstance } from "antd";
import { ChevronDown, ChevronUp, Minus, Plus, Users } from "lucide-react";
import type { DynamicField } from "@/backend/schemas/dynamicFormSchemas";
import { MAX_BATCH_SIZE } from "@/backend/schemas/batchRegistrationSchemas";
import { RegistrationForm } from "./RegistrationForm";
import { DynamicFormRenderer } from "./DynamicFormRenderer";

/** Participante adicional (pessoas 2..N) de uma compra em grupo. */
export interface BatchExtra {
  key: string;
  /** Valores dos campos (fixos + `dynamicFormData`), espelhados do formulário do card. */
  values: Record<string, unknown>;
  wantsShirt: boolean;
  shirtSize: string | null;
}

export type CardStatus = "complete" | "incomplete" | "error";

interface ParticipantCardProps {
  index: number;
  extra: BatchExtra;
  open: boolean;
  hasError: boolean;
  isFree: boolean;
  emailRequired: boolean;
  phoneRequired: boolean;
  dynamicFields: DynamicField[];
  showDynamic: boolean;
  mainForm: FormInstance;
  onToggle: () => void;
  onRemove: () => void;
  onRegisterForm: (key: string, form: FormInstance | null) => void;
}

const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

function ParticipantCard({
  index,
  extra,
  open,
  hasError,
  isFree,
  emailRequired,
  phoneRequired,
  dynamicFields,
  showDynamic,
  mainForm,
  onToggle,
  onRemove,
  onRegisterForm,
}: ParticipantCardProps) {
  const [form] = Form.useForm();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const values = Form.useWatch([], form) as Record<string, unknown> | undefined;

  // Restaura o que já tinha sido digitado (voltar da etapa de pagamento).
  useEffect(() => {
    form.setFieldsValue(extra.values);
    onRegisterForm(extra.key, form);
    return () => onRegisterForm(extra.key, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ao abrir o card, leva-o para a área visível.
  useEffect(() => {
    if (open && rootRef.current) {
      rootRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [open]);

  const name = String(values?.name ?? extra.values.name ?? "").trim();
  const complete =
    name.length >= 2 &&
    onlyDigits(values?.cpf ?? extra.values.cpf).length === 11 &&
    (!emailRequired || String(values?.email ?? extra.values.email ?? "").trim()) &&
    (!phoneRequired || onlyDigits(values?.phone ?? extra.values.phone).length >= 10);

  const status: CardStatus = hasError
    ? "error"
    : complete
      ? "complete"
      : "incomplete";

  const badge = {
    complete: { text: "Preenchido", cls: "bg-green-100 text-green-800" },
    incomplete: { text: "Faltam dados", cls: "bg-gray-100 text-gray-700" },
    error: { text: "Corrigir", cls: "bg-red-100 text-red-700" },
  }[status];

  const copyContact = () => {
    form.setFieldsValue({
      email: mainForm.getFieldValue("email"),
      phone: mainForm.getFieldValue("phone"),
    });
  };

  return (
    <div
      ref={rootRef}
      data-testid={`batch-card-${index}`}
      className={`border-2 rounded-lg mb-3 bg-white ${
        hasError ? "border-red-400" : "border-gray-200"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{ minHeight: "60px" }}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-xs text-gray-500">Pessoa {index + 2}</span>
          <span className="block font-medium truncate">
            {name || "Toque para preencher"}
          </span>
        </span>
        <span className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-1 rounded ${badge.cls}`}>
            {badge.text}
          </span>
          {open ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </span>
      </button>

      {/* Fica montado (só oculto) para o que foi digitado nunca se perder */}
      <div className={open ? "px-4 pb-4" : "hidden"}>
        <RegistrationForm
          form={form}
          loading={false}
          disabled={false}
          isFree={isFree}
          emailRequired={emailRequired}
          phoneRequired={phoneRequired}
          namePlaceholder="Nome completo desta pessoa"
          hideButtons
          onSubmit={async () => {}}
          onCancel={() => {}}
          onCpfChange={() => {}}
        />
        {showDynamic && dynamicFields.length > 0 && (
          <div className="mt-4">
            <DynamicFormRenderer
              fields={dynamicFields}
              form={form}
              loading={false}
              hideButtons
            />
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <button
            type="button"
            onClick={copyContact}
            style={{ minHeight: "48px" }}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
          >
            Usar e-mail e telefone do responsável
          </button>
          <button
            type="button"
            onClick={onRemove}
            style={{ minHeight: "48px" }}
            className="px-4 py-2 border border-red-200 text-red-700 rounded hover:bg-red-50 text-sm"
          >
            Remover esta pessoa
          </button>
        </div>
      </div>
    </div>
  );
}

interface BatchParticipantsSectionProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  /** Total de pessoas na compra, incluindo o responsável. */
  count: number;
  onCountChange: (count: number) => void;
  extras: BatchExtra[];
  openKey: string | null;
  onOpenKeyChange: (key: string | null) => void;
  /** Chaves de cards com erro (validação local ou devolvida pelo servidor). */
  errorKeys: string[];
  isFree: boolean;
  emailRequired: boolean;
  phoneRequired: boolean;
  dynamicFields: DynamicField[];
  showDynamic: boolean;
  mainForm: FormInstance;
  onRegisterForm: (key: string, form: FormInstance | null) => void;
  onRemoveExtra: (key: string) => void;
}

export function BatchParticipantsSection({
  enabled,
  onEnabledChange,
  count,
  onCountChange,
  extras,
  openKey,
  onOpenKeyChange,
  errorKeys,
  isFree,
  emailRequired,
  phoneRequired,
  dynamicFields,
  showDynamic,
  mainForm,
  onRegisterForm,
  onRemoveExtra,
}: BatchParticipantsSectionProps) {
  return (
    <div className="mt-6 border-t pt-4" data-testid="batch-section">
      <label
        className="flex items-start gap-3 cursor-pointer"
        style={{ minHeight: "48px" }}
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="mt-1 h-6 w-6 flex-shrink-0"
          data-testid="batch-toggle"
        />
        <span>
          <span className="flex items-center gap-2 font-medium">
            <Users className="h-5 w-5" />
            Inscrever mais pessoas nesta mesma compra
          </span>
          <span className="block text-sm text-gray-600">
            {isFree
              ? "Você preenche os dados de todos e confirma tudo de uma vez."
              : "Você paga tudo de uma vez e recebe o comprovante de cada pessoa."}
          </span>
        </span>
      </label>

      {enabled && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 mb-4 p-3 bg-blue-50 rounded-lg">
            <span className="text-sm font-medium text-gray-800">
              Quantas pessoas no total?
              <span className="block text-xs font-normal text-gray-600">
                Contando com você (máximo {MAX_BATCH_SIZE})
              </span>
            </span>
            <span className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Menos uma pessoa"
                onClick={() => onCountChange(count - 1)}
                disabled={count <= 2}
                style={{ width: "48px", height: "48px" }}
                className="flex items-center justify-center border-2 border-blue-600 text-blue-700 rounded-full disabled:opacity-40"
              >
                <Minus className="h-5 w-5" />
              </button>
              <span
                className="text-xl font-bold w-8 text-center"
                data-testid="batch-count"
              >
                {count}
              </span>
              <button
                type="button"
                aria-label="Mais uma pessoa"
                onClick={() => onCountChange(count + 1)}
                disabled={count >= MAX_BATCH_SIZE}
                style={{ width: "48px", height: "48px" }}
                className="flex items-center justify-center bg-blue-600 text-white rounded-full disabled:opacity-40"
              >
                <Plus className="h-5 w-5" />
              </button>
            </span>
          </div>

          <p className="text-sm text-gray-600 mb-3">
            Os dados acima são os do responsável pela compra. Preencha abaixo
            as demais pessoas — cada uma abre e fecha no próprio cartão.
          </p>

          {extras.map((extra, i) => (
            <ParticipantCard
              key={extra.key}
              index={i}
              extra={extra}
              open={openKey === extra.key}
              hasError={errorKeys.includes(extra.key)}
              isFree={isFree}
              emailRequired={emailRequired}
              phoneRequired={phoneRequired}
              dynamicFields={dynamicFields}
              showDynamic={showDynamic}
              mainForm={mainForm}
              onToggle={() =>
                onOpenKeyChange(openKey === extra.key ? null : extra.key)
              }
              onRemove={() => onRemoveExtra(extra.key)}
              onRegisterForm={onRegisterForm}
            />
          ))}
        </div>
      )}
    </div>
  );
}
