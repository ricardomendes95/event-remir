import React from "react";
import {
  Form,
  Input,
  InputNumber,
  Select,
  Radio,
  Checkbox,
  Button,
  FormInstance,
  Typography,
} from "antd";
import { isValidCpf } from "@/utils/cpfValidator";
import type { DynamicField } from "@/backend/schemas/dynamicFormSchemas";

const { Text } = Typography;

interface DynamicFormRendererProps {
  fields: DynamicField[];
  form: FormInstance;
  loading: boolean;
  disabled?: boolean;
  hideButtons?: boolean;
  submitLabel?: string;
  onSubmit?: (data: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
}

function formatCPF(value: string): string {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length >= 11) return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (cpf.length >= 9) return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/-$/, "");
  if (cpf.length >= 6) return cpf.replace(/(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3").replace(/\.$/, "");
  if (cpf.length >= 3) return cpf.replace(/(\d{3})(\d{0,3})/, "$1.$2").replace(/\.$/, "");
  return cpf;
}

function formatPhone(value: string): string {
  const phone = value.replace(/\D/g, "");
  if (phone.length >= 11) return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (phone.length >= 10) return phone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  if (phone.length >= 6) return phone.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  if (phone.length >= 2) return phone.replace(/(\d{2})(\d{0,5})/, "($1) $2").replace(/ $/, "");
  return phone;
}

function buildRules(field: DynamicField) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rules: any[] = [];

  if (field.required) {
    const isCheckbox = field.type === "checkbox";
    rules.push({
      required: true,
      message: `${field.label} é obrigatório`,
      ...(isCheckbox ? { type: "array", min: 1 } : {}),
    });
  }

  if (field.type === "text" || field.type === "textarea") {
    const f = field as typeof field & {
      minLength?: number;
      maxLength?: number;
    };
    if (f.minLength)
      rules.push({ min: f.minLength, message: `Mínimo ${f.minLength} caracteres` });
    if (f.maxLength)
      rules.push({ max: f.maxLength, message: `Máximo ${f.maxLength} caracteres` });
  }

  if (field.type === "number") {
    const f = field as typeof field & {
      min?: number;
      max?: number;
      integer?: boolean;
    };
    rules.push({
      validator: (_: unknown, value: unknown) => {
        if (value === undefined || value === null || value === "") {
          return field.required ? Promise.reject(`${field.label} é obrigatório`) : Promise.resolve();
        }
        const n = Number(value);
        if (isNaN(n)) return Promise.reject("Valor inválido");
        if (f.min !== undefined && n < f.min)
          return Promise.reject(`Valor mínimo: ${f.min}`);
        if (f.max !== undefined && n > f.max)
          return Promise.reject(`Valor máximo: ${f.max}`);
        if (f.integer && !Number.isInteger(n))
          return Promise.reject("O valor deve ser inteiro");
        return Promise.resolve();
      },
    });
  }

  if (field.type === "cpf") {
    rules.push({
      validator: (_: unknown, value: unknown) => {
        if (!value) return field.required ? Promise.reject("CPF é obrigatório") : Promise.resolve();
        const digits = String(value).replace(/\D/g, "");
        if (digits.length < 11) return Promise.resolve();
        const { isValid, error } = isValidCpf(digits);
        return isValid ? Promise.resolve() : Promise.reject(error ?? "CPF inválido");
      },
    });
  }

  if (field.type === "phone") {
    rules.push({
      validator: (_: unknown, value: unknown) => {
        if (!value) return field.required ? Promise.reject("Telefone é obrigatório") : Promise.resolve();
        const digits = String(value).replace(/\D/g, "");
        if (digits.length < 10) return Promise.resolve();
        if (digits.length > 11) return Promise.reject("Telefone inválido");
        return Promise.resolve();
      },
    });
  }

  return rules;
}

export function DynamicFormRenderer({
  fields,
  form,
  loading,
  disabled = false,
  hideButtons = false,
  submitLabel = "Confirmar",
  onSubmit,
  onCancel,
}: DynamicFormRendererProps) {
  const handleFinish = async (values: Record<string, unknown>) => {
    await onSubmit?.(values.dynamicFormData as Record<string, unknown>);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={hideButtons ? undefined : handleFinish}
      requiredMark={false}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((field) => {
          const rules = buildRules(field);
          const fieldProps = field as DynamicField & {
            placeholder?: string;
            options?: { value: string; label: string }[];
            multi?: boolean;
          };

          let control: React.ReactNode;

          switch (field.type) {
            case "text":
              control = (
                <Input
                  placeholder={fieldProps.placeholder ?? `Digite ${field.label.toLowerCase()}`}
                  size="large"
                  disabled={disabled}
                />
              );
              break;

            case "textarea":
              control = (
                <Input.TextArea
                  placeholder={fieldProps.placeholder ?? `Digite ${field.label.toLowerCase()}`}
                  rows={3}
                  disabled={disabled}
                />
              );
              break;

            case "number":
              control = (
                <InputNumber
                  style={{ width: "100%" }}
                  size="large"
                  disabled={disabled}
                />
              );
              break;

            case "phone":
              control = (
                <Input
                  placeholder="(00) 00000-0000"
                  size="large"
                  inputMode="tel"
                  maxLength={15}
                  disabled={disabled}
                  onChange={(e) => {
                    const formatted = formatPhone(e.target.value);
                    form.setFieldValue(["dynamicFormData", field.id], formatted);
                  }}
                />
              );
              break;

            case "cpf":
              control = (
                <Input
                  placeholder="000.000.000-00"
                  size="large"
                  inputMode="numeric"
                  maxLength={14}
                  disabled={disabled}
                  onChange={(e) => {
                    const formatted = formatCPF(e.target.value);
                    form.setFieldValue(["dynamicFormData", field.id], formatted);
                  }}
                />
              );
              break;

            case "select":
              control = (
                <Select
                  size="large"
                  placeholder={`Selecione ${field.label.toLowerCase()}`}
                  disabled={disabled}
                  options={(fieldProps.options ?? []).map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                />
              );
              break;

            case "radio":
              control = (
                <Radio.Group disabled={disabled}>
                  {(fieldProps.options ?? []).map((o) => (
                    <Radio key={o.value} value={o.value}>
                      {o.label}
                    </Radio>
                  ))}
                </Radio.Group>
              );
              break;

            case "checkbox":
              if (fieldProps.multi) {
                control = (
                  <Checkbox.Group disabled={disabled}>
                    <div className="flex flex-col gap-2">
                      {(fieldProps.options ?? []).map((o) => (
                        <Checkbox key={o.value} value={o.value}>
                          {o.label}
                        </Checkbox>
                      ))}
                    </div>
                  </Checkbox.Group>
                );
              } else {
                // Single checkbox — boolean value
                control = (
                  <Checkbox disabled={disabled}>
                    {fieldProps.options?.[0]?.label ?? field.label}
                  </Checkbox>
                );
              }
              break;

            default:
              control = <Input size="large" disabled={disabled} />;
          }

          const isFullWidth =
            field.type === "textarea" ||
            field.type === "radio" ||
            (field.type === "checkbox" && fieldProps.multi);

          return (
            <div key={field.id} className={isFullWidth ? "md:col-span-2" : ""}>
              <Form.Item
                name={["dynamicFormData", field.id]}
                label={
                  <span>
                    {field.label}
                    {field.required && (
                      <Text type="danger" style={{ marginLeft: 4 }}>
                        *
                      </Text>
                    )}
                  </span>
                }
                rules={rules}
                valuePropName={
                  field.type === "checkbox" && !fieldProps.multi
                    ? "checked"
                    : "value"
                }
                extra={
                  fieldProps.helpText ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {fieldProps.helpText}
                    </Text>
                  ) : undefined
                }
              >
                {control}
              </Form.Item>
            </div>
          );
        })}
      </div>

      {!hideButtons && (
        <div className="mt-6 pt-4 border-t">
          <div className="flex flex-col sm:flex-row gap-3 dyn-buttons">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              disabled={disabled}
              className="flex-1 sm:order-2 text-base font-medium primary-button"
            >
              {loading ? "Processando..." : submitLabel}
            </Button>
            {onCancel && (
              <Button
                onClick={onCancel}
                className="flex-1 sm:order-1 secondary-button"
              >
                Cancelar
              </Button>
            )}
          </div>
          <style>{`
            .dyn-buttons .primary-button { height: 64px !important; min-height: 64px !important; display: flex !important; align-items: center !important; justify-content: center !important; }
            .dyn-buttons .secondary-button { height: 56px !important; min-height: 56px !important; display: flex !important; align-items: center !important; justify-content: center !important; }
            @media (min-width: 640px) {
              .dyn-buttons .primary-button, .dyn-buttons .secondary-button { height: 40px !important; min-height: 40px !important; }
            }
          `}</style>
        </div>
      )}
    </Form>
  );
}
