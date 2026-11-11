"use client";

import React from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Row,
  Col,
  Tag,
  Radio,
  message,
} from "antd";
import type { FormInstance } from "antd";
import { z } from "zod";
import { DynamicFormRenderer } from "@/components/registration/DynamicFormRenderer";
import type { DynamicField } from "@/backend/schemas/dynamicFormSchemas";
import type { EventFormMode } from "@/types/event";
import {
  MANUAL_PAYMENT_TYPE_LABELS,
  REGISTRATION_NOTES_MAX_LENGTH,
  type ManualPaymentTypeValue,
} from "@/backend/schemas/registrationSchemas";

const { Option } = Select;

const registrationSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome muito longo"),
  email: z.string().or(z.literal("")).optional(),
  cpf: z
    .string()
    .min(11, "CPF deve ter 11 dígitos")
    .refine((cpf) => cpf.replace(/\D/g, "").length === 11, "CPF deve ter 11 dígitos"),
  phone: z.string().optional(),
  eventId: z.string().min(1, "Evento é obrigatório"),
  status: z
    .enum(["PENDING", "CONFIRMED", "CANCELLED", "PAYMENT_FAILED"])
    .default("CONFIRMED"),
  // MERCADO_PAGO permanece aceito apenas para editar inscrições históricas
  paymentMethod: z
    .enum(["INFINITE_PAY", "MERCADO_PAGO", "MANUAL"])
    .default("MANUAL"),
  dynamicFormData: z.record(z.string(), z.unknown()).optional(),
  manualPaymentType: z.enum(["PIX", "CASH", "CARD"]).nullish(),
  cashResponsible: z.string().max(100).nullish(),
  notes: z.string().max(REGISTRATION_NOTES_MAX_LENGTH).nullish(),
});

interface Event {
  id: string;
  title: string;
  price: number;
  startDate: string;
  isActive: boolean;
  isFree?: boolean;
  formMode?: EventFormMode;
  dynamicFormFields?: unknown;
  fixedFieldsConfig?: { email?: { required: boolean }; phone?: { required: boolean } };
  shirtConfig?: { enabled: boolean; priceWithShirt: number; sizes: string[] };
}

interface Registration {
  id: string;
  name: string;
  email: string | null;
  cpf: string;
  phone: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "PAYMENT_FAILED";
  paymentId?: string;
  paymentMethod?: string;
  manualPaymentType?: ManualPaymentTypeValue | null;
  cashResponsible?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  dynamicFormData?: Record<string, unknown>;
  event: {
    id: string;
    title: string;
    price: number;
    startDate: string;
  };
}

interface RegistrationFormData {
  name: string;
  email?: string;
  cpf: string;
  phone?: string;
  eventId: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "PAYMENT_FAILED";
  dynamicFormData?: Record<string, unknown>;
  wantsShirt?: boolean;
  shirtSize?: string;
  paymentMethod?: string;
  manualPaymentType?: ManualPaymentTypeValue | null;
  cashResponsible?: string | null;
  notes?: string | null;
}

interface RegistrationModalProps {
  isVisible: boolean;
  editingRegistration: Registration | null;
  events: Event[];
  form: FormInstance;
  onCancel: () => void;
  onSave: (values: RegistrationFormData) => void;
  /** false para perfis sem acesso a valores financeiros (ADR-002) */
  showValues?: boolean;
}

export default function RegistrationModal({
  isVisible,
  editingRegistration,
  events,
  form,
  onCancel,
  onSave,
  showValues = true,
}: RegistrationModalProps) {
  const watchedEventId = Form.useWatch("eventId", form);
  const effectiveEventId =
    watchedEventId ?? editingRegistration?.event.id;
  const selectedEvent = events.find((e) => e.id === effectiveEventId) ?? null;

  const isFreeEvent = selectedEvent?.isFree ?? false;
  const cfg = selectedEvent?.fixedFieldsConfig;
  const emailRequired = isFreeEvent ? !!(cfg?.email?.required) : true;
  const phoneRequired = isFreeEvent ? !!(cfg?.phone?.required) : true;
  const dynamicFields =
    (selectedEvent?.dynamicFormFields as DynamicField[] | null) ?? [];
  const showDynamic =
    (selectedEvent?.formMode ?? "FIXED_ONLY") !== "FIXED_ONLY" &&
    dynamicFields.length > 0;

  // Camisa: só evento pago com a opção habilitada
  const shirtConfig =
    !isFreeEvent && selectedEvent?.shirtConfig?.enabled
      ? selectedEvent.shirtConfig
      : null;
  const watchedWantsShirt = Form.useWatch("wantsShirt", form) as
    | boolean
    | undefined;

  const watchedPaymentMethod = Form.useWatch("paymentMethod", form) as
    | string
    | undefined;
  const watchedManualType = Form.useWatch("manualPaymentType", form) as
    | ManualPaymentTypeValue
    | undefined;
  const isManual = watchedPaymentMethod === "MANUAL";

  const formatCPF = (value: string) => {
    const cpf = value.replace(/\D/g, "");
    if (cpf.length <= 11) {
      return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return value;
  };

  const formatPhone = (value: string) => {
    const phone = value.replace(/\D/g, "");
    if (phone.length <= 10) {
      return phone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    } else if (phone.length <= 11) {
      return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    return value;
  };

  const validateCPF = (_: unknown, value: string) => {
    if (!value) return Promise.resolve();
    const cleanCpf = value.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      return Promise.reject(new Error("CPF deve ter 11 dígitos"));
    }
    return Promise.resolve();
  };

  const validatePhone = (_: unknown, value: string) => {
    if (!value) return Promise.resolve();
    const cleanPhone = value.replace(/\D/g, "");
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      return Promise.reject(new Error("Telefone deve ter entre 10 e 11 dígitos"));
    }
    return Promise.resolve();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      onSave(values as RegistrationFormData);
    } catch (errorInfo: unknown) {
      const info = errorInfo as { errorFields?: Array<{ errors: string[] }> };
      const firstError = info?.errorFields?.[0]?.errors?.[0];
      message.error(firstError ?? "Verifique os campos obrigatórios antes de salvar");
    }
  };

  return (
    <Modal
      title={editingRegistration ? "Editar Inscrição" : "Nova Inscrição Manual"}
      open={isVisible}
      onCancel={onCancel}
      footer={null}
      width={600}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="eventId"
              label="Evento"
              rules={[{ required: true, message: "Evento é obrigatório" }]}
              initialValue={
                editingRegistration?.event.id ||
                events.filter((event) => event.isActive)[0]?.id
              }
            >
              <Select
                placeholder="Selecione o evento"
                size="large"
                onChange={() => {
                  form.setFieldValue("dynamicFormData", undefined);
                  form.setFieldValue("wantsShirt", false);
                  form.setFieldValue("shirtSize", undefined);
                }}
              >
                {events
                  .filter((event) => event.isActive)
                  .map((event) => (
                    <Option key={event.id} value={event.id}>
                      {event.title}
                      {event.isFree
                        ? " — Gratuito"
                        : showValues
                          ? ` — R$ ${event.price.toFixed(2)}`
                          : ""}
                    </Option>
                  ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="name"
              label="Nome Completo"
              rules={[
                { required: true, message: "Nome é obrigatório" },
                { min: 2, message: "Nome deve ter pelo menos 2 caracteres" },
              ]}
            >
              <Input placeholder="Nome completo" size="large" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="email"
              label="Email"
              rules={[
                ...(emailRequired
                  ? [{ required: true, message: "Email é obrigatório" }]
                  : []),
                {
                  validator: (_: unknown, value: string) => {
                    if (!value) return Promise.resolve();
                    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
                      ? Promise.resolve()
                      : Promise.reject(new Error("Email inválido"));
                  },
                },
              ]}
            >
              <Input placeholder="email@exemplo.com" size="large" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="cpf"
              label="CPF"
              rules={[
                { required: true, message: "CPF é obrigatório" },
                { validator: validateCPF },
              ]}
              getValueFromEvent={(e: React.ChangeEvent<HTMLInputElement>) =>
                formatCPF(e.target.value)
              }
            >
              <Input
                placeholder="000.000.000-00"
                size="large"
                maxLength={14}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="phone"
              label="Telefone"
              rules={[
                ...(phoneRequired
                  ? [{ required: true, message: "Telefone é obrigatório" }]
                  : []),
                { validator: validatePhone },
              ]}
              getValueFromEvent={(e: React.ChangeEvent<HTMLInputElement>) =>
                formatPhone(e.target.value)
              }
            >
              <Input
                placeholder="(00) 00000-0000"
                size="large"
                maxLength={15}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="status"
              label="Status da Inscrição"
              rules={[{ required: true, message: "Status é obrigatório" }]}
              initialValue="CONFIRMED"
            >
              <Select placeholder="Selecione o status" size="large">
                <Option value="CONFIRMED">
                  <Tag color="green">Confirmado</Tag>
                </Option>
                <Option value="PENDING">
                  <Tag color="orange">Pendente</Tag>
                </Option>
                <Option value="CANCELLED">
                  <Tag color="red">Cancelado</Tag>
                </Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="paymentMethod"
              label="Método de Pagamento"
              initialValue="MANUAL"
              rules={[{ required: true, message: "Método de pagamento é obrigatório" }]}
            >
              <Select
                placeholder="Selecione o método de pagamento"
                size="large"
                onChange={(value: string) => {
                  if (value !== "MANUAL") {
                    form.setFieldValue("manualPaymentType", undefined);
                    form.setFieldValue("cashResponsible", undefined);
                  }
                }}
              >
                <Option value="INFINITE_PAY">
                  <Tag color="blue">InfinitePay</Tag>
                </Option>
                <Option value="MANUAL">
                  <Tag color="orange">Manual</Tag>
                </Option>
              </Select>
            </Form.Item>
          </Col>
          {isManual && (
            <Col span={24}>
              <Form.Item
                name="manualPaymentType"
                label="Como foi pago?"
                rules={[
                  { required: true, message: "Informe como foi pago (PIX, Dinheiro ou Cartão)" },
                ]}
              >
                <Select
                  placeholder="PIX, Dinheiro ou Cartão"
                  size="large"
                  onChange={(value: string) => {
                    if (value !== "CASH") {
                      form.setFieldValue("cashResponsible", undefined);
                    }
                  }}
                >
                  {(
                    Object.keys(
                      MANUAL_PAYMENT_TYPE_LABELS
                    ) as ManualPaymentTypeValue[]
                  ).map((type) => (
                    <Option key={type} value={type}>
                      {MANUAL_PAYMENT_TYPE_LABELS[type]}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          )}
          {isManual && watchedManualType === "CASH" && (
            <Col span={24}>
              <Form.Item
                name="cashResponsible"
                label="Responsável pelo dinheiro"
                extra="Quem está com o dinheiro recebido (opcional)."
                rules={[{ max: 100, message: "Nome muito longo" }]}
              >
                <Input placeholder="Nome de quem recebeu" size="large" maxLength={100} />
              </Form.Item>
            </Col>
          )}
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="notes"
              label="Observação"
              extra="Só para a equipe. Não aparece para o participante."
            >
              <Input.TextArea
                rows={3}
                size="large"
                maxLength={REGISTRATION_NOTES_MAX_LENGTH}
                showCount
                placeholder="Ex.: pagou em dinheiro com a irmã. Não registre dados sensíveis desnecessários."
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Camisa do evento */}
        {shirtConfig && (
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="wantsShirt"
                label="Camisa"
                initialValue={false}
              >
                <Radio.Group
                  onChange={(e) => {
                    if (!e.target.value) {
                      form.setFieldValue("shirtSize", undefined);
                    }
                  }}
                >
                  <Radio value={false}>
                    {showValues
                      ? `Sem camisa (R$ ${selectedEvent?.price.toFixed(2)})`
                      : "Sem camisa"}
                  </Radio>
                  <Radio value={true}>
                    {showValues
                      ? `Com camisa (R$ ${shirtConfig.priceWithShirt.toFixed(2)})`
                      : "Com camisa"}
                  </Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            {watchedWantsShirt && (
              <Col span={24}>
                <Form.Item
                  name="shirtSize"
                  label="Tamanho da camisa"
                  rules={[
                    { required: true, message: "Escolha o tamanho da camisa" },
                  ]}
                >
                  <Select placeholder="Selecione o tamanho" size="large">
                    {shirtConfig.sizes.map((size) => (
                      <Option key={size} value={size}>
                        {size}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            )}
          </Row>
        )}

        {/* Campos dinâmicos do evento */}
        {showDynamic && (
          <div className="mt-2 pt-4 border-t">
            <p className="text-sm font-medium text-gray-600 mb-3">
              Campos adicionais do evento
            </p>
            <DynamicFormRenderer
              fields={dynamicFields}
              form={form}
              loading={false}
              hideButtons
            />
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t">
          <Button onClick={onCancel} size="large">
            Cancelar
          </Button>
          <Button type="primary" onClick={handleSubmit} size="large">
            {editingRegistration ? "Atualizar" : "Criar"} Inscrição
          </Button>
        </div>
      </Form>
    </Modal>
  );
}

export { registrationSchema };
