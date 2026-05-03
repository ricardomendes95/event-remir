"use client";

import React from "react";
import {
  Modal,
  Form,
  Input,
  DatePicker,
  Switch,
  Button,
  message,
  ConfigProvider,
  Radio,
  Alert,
  Checkbox,
} from "antd";
import dayjs from "dayjs";
import locale from "antd/locale/pt_BR";
import "dayjs/locale/pt-br";
import { ImageUpload } from "../ImageUpload";
import { MoneyInput } from "../MoneyInput";
import RichTextEditor from "../RichTextEditor";
import { PaymentConfigForm } from "./PaymentConfigForm";
import { DynamicFormBuilder } from "./DynamicFormBuilder";
import {
  useEventValidation,
  EventFormData,
} from "../../hooks/useEventValidation";
import { generateSlug } from "../../utils/slugUtils";
import { PaymentConfig } from "@/backend/schemas/eventSchemas";
import type { DynamicField } from "@/backend/schemas/dynamicFormSchemas";

interface Event {
  id: string;
  title: string;
  description: string;
  slug: string;
  startDate: string;
  endDate: string;
  registrationStartDate: string;
  registrationEndDate: string;
  location: string;
  maxParticipants: number;
  price: number;
  bannerUrl?: string;
  isActive: boolean;
  isFree?: boolean;
  formMode?: "FIXED_ONLY" | "DYNAMIC_ONLY" | "BOTH";
  dynamicFormFields?: DynamicField[];
  fixedFieldsConfig?: { email?: { required: boolean }; phone?: { required: boolean } };
  paymentConfig?: PaymentConfig;
  _count?: { registrations: number };
}

interface EventModalProps {
  visible: boolean;
  editingEvent: Event | null;
  onCancel: () => void;
  onSuccess: () => void;
}

export default function EventModal({
  visible,
  editingEvent,
  onCancel,
  onSuccess,
}: EventModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const { validateFormData, setApiErrors, clearErrors, getFieldError } =
    useEventValidation();

  const isFree = Form.useWatch("isFree", form) as boolean | undefined;
  const formMode = Form.useWatch("formMode", form) as
    | "FIXED_ONLY"
    | "DYNAMIC_ONLY"
    | "BOTH"
    | undefined;
  const watchedPrice = Form.useWatch("price", form) as number | undefined;

  const hasRegistrations = (editingEvent?._count?.registrations ?? 0) > 0;

  // Configurar locale brasileiro para dayjs
  React.useEffect(() => {
    dayjs.locale("pt-br");
  }, []);

  // Resetar formulário quando o modal abrir/fechar
  React.useEffect(() => {
    if (visible && editingEvent) {
      form.setFieldsValue({
        ...editingEvent,
        startDate: dayjs(editingEvent.startDate),
        endDate: dayjs(editingEvent.endDate),
        registrationStartDate: dayjs(editingEvent.registrationStartDate),
        registrationEndDate: dayjs(editingEvent.registrationEndDate),
        isFree: editingEvent.isFree ?? false,
        formMode: editingEvent.formMode ?? "FIXED_ONLY",
        dynamicFormFields: editingEvent.dynamicFormFields ?? [],
      });
      clearErrors();
    } else if (visible && !editingEvent) {
      form.resetFields();
      form.setFieldsValue({ isFree: false, formMode: "FIXED_ONLY" });
      clearErrors();
    }
  }, [visible, editingEvent, form, clearErrors]);

  // Salvar evento (criar ou editar)
  const handleSave = async (values: EventFormData) => {
    setLoading(true);
    clearErrors();

    try {
      // Validação local primeiro
      const validation = validateFormData(values);
      if (!validation.isValid) {
        message.error("Por favor, corrija os erros no formulário");
        setLoading(false);
        return;
      }

      // Preparar dados para envio
      const isFreeVal = values.isFree ?? false;
      const formModeVal = values.formMode ?? "FIXED_ONLY";
      const eventData = {
        ...values,
        startDate: dayjs(values.startDate).toISOString(),
        endDate: dayjs(values.endDate).toISOString(),
        registrationStartDate: dayjs(
          values.registrationStartDate
        ).toISOString(),
        registrationEndDate: dayjs(values.registrationEndDate).toISOString(),
        maxParticipants: parseInt(values.maxParticipants.toString()),
        price: isFreeVal ? 0 : parseFloat(values.price.toString()),
        bannerUrl: values.bannerUrl || undefined,
        paymentConfig: isFreeVal ? undefined : (values.paymentConfig || undefined),
        isFree: isFreeVal,
        formMode: formModeVal,
        dynamicFormFields:
          formModeVal === "FIXED_ONLY"
            ? undefined
            : (values.dynamicFormFields ?? []),
        fixedFieldsConfig: isFreeVal
          ? {
              email: { required: !!(values.fixedFieldsConfig?.email?.required) },
              phone: { required: !!(values.fixedFieldsConfig?.phone?.required) },
            }
          : undefined,
      };

      let response;
      if (editingEvent) {
        response = await fetch(`/api/events/${editingEvent.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventData),
        });
      } else {
        response = await fetch("/api/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventData),
        });
      }

      const result = await response.json();

      if (result.success) {
        message.success(
          editingEvent
            ? "Evento atualizado com sucesso!"
            : "Evento criado com sucesso!"
        );
        form.resetFields();
        clearErrors();
        onSuccess();
      } else {
        // Se houver erros de validação da API, exibir nos campos
        if (result.errors && Array.isArray(result.errors)) {
          setApiErrors(result.errors);
          message.error("Corrija os erros indicados nos campos");
        } else {
          message.error(result.error || "Erro ao salvar evento");
        }
      }
    } catch (error) {
      message.error("Erro ao salvar evento");
      console.error("Error saving event:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    clearErrors();
    onCancel();
  };

  // Gerar slug automaticamente quando o título mudar
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    // Só gera slug automaticamente se estamos criando um novo evento e o slug está vazio.
    // setTimeout evita re-entrant call dentro do processamento interno do Form.Item.
    if (!editingEvent && !form.getFieldValue("slug")) {
      setTimeout(() => {
        form.setFieldValue("slug", generateSlug(title));
      }, 0);
    }
  };

  return (
    <ConfigProvider locale={locale}>
      <Modal
        title={editingEvent ? "Editar Evento" : "Novo Evento"}
        open={visible}
        onCancel={handleCancel}
        footer={null}
        width={800}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          className="mt-4"
          initialValues={{ isActive: true }}
        >
          <Form.Item
            name="title"
            label="Título"
            rules={[
              { required: true, message: "Título é obrigatório" },
              { min: 3, message: "Título deve ter pelo menos 3 caracteres" },
              { max: 100, message: "Título muito longo" },
            ]}
            validateStatus={getFieldError("title") ? "error" : ""}
            help={getFieldError("title")}
          >
            <Input
              placeholder="Título do evento"
              onChange={handleTitleChange}
            />
          </Form.Item>

          <Form.Item
            name="slug"
            label="Slug (URL amigável)"
            rules={[
              { required: true, message: "Slug é obrigatório" },
              { min: 3, message: "Slug deve ter pelo menos 3 caracteres" },
              { max: 100, message: "Slug muito longo" },
              {
                pattern: /^[a-z0-9-]+$/,
                message:
                  "Slug deve conter apenas letras minúsculas, números e hífens",
              },
            ]}
            validateStatus={getFieldError("slug") ? "error" : ""}
            help={getFieldError("slug")}
          >
            <Input placeholder="evento-exemplo" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Descrição"
            rules={[
              { required: true, message: "Descrição é obrigatória" },
              {
                min: 10,
                message: "Descrição deve ter pelo menos 10 caracteres",
              },
              {
                max: 2000,
                message: "Descrição muito longa (máximo 2000 caracteres)",
              },
            ]}
            validateStatus={getFieldError("description") ? "error" : ""}
            help={getFieldError("description")}
          >
            <RichTextEditor
              placeholder="Descrição detalhada do evento..."
              maxLength={2000}
              rows={8}
            />
          </Form.Item>

          <Form.Item
            name="location"
            label="Local"
            rules={[
              { required: true, message: "Local é obrigatório" },
              { min: 5, message: "Local deve ter pelo menos 5 caracteres" },
              { max: 200, message: "Local muito longo" },
            ]}
            validateStatus={getFieldError("location") ? "error" : ""}
            help={getFieldError("location")}
          >
            <Input placeholder="Local do evento" />
          </Form.Item>
          <Form.Item shouldUpdate={(prev, curr) => prev.location !== curr.location} noStyle>
            {({ getFieldValue }) => {
              const loc: string = getFieldValue("location");
              return loc && loc.length >= 5 ? (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(loc)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline"
                  style={{ display: "block", marginTop: -16, marginBottom: 16 }}
                >
                  Ver no mapa ↗
                </a>
              ) : null;
            }}
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="startDate"
              label="Data de Início do Evento"
              rules={[
                { required: true, message: "Data de início é obrigatória" },
              ]}
              validateStatus={
                getFieldError("startDate") || getFieldError("endDate")
                  ? "error"
                  : ""
              }
              help={getFieldError("startDate")}
            >
              <DatePicker
                showTime
                format="DD/MM/YYYY HH:mm"
                placeholder="Data de início"
                className="w-full"
              />
            </Form.Item>

            <Form.Item
              name="endDate"
              label="Data de Fim do Evento"
              rules={[{ required: true, message: "Data de fim é obrigatória" }]}
              validateStatus={getFieldError("endDate") ? "error" : ""}
              help={getFieldError("endDate")}
            >
              <DatePicker
                showTime
                format="DD/MM/YYYY HH:mm"
                placeholder="Data de fim"
                className="w-full"
              />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="registrationStartDate"
              label="Início das Inscrições"
              rules={[
                {
                  required: true,
                  message: "Data de início das inscrições é obrigatória",
                },
              ]}
              validateStatus={
                getFieldError("registrationStartDate") ||
                getFieldError("registrationEndDate")
                  ? "error"
                  : ""
              }
              help={getFieldError("registrationStartDate")}
            >
              <DatePicker
                showTime
                format="DD/MM/YYYY HH:mm"
                placeholder="Início das inscrições"
                className="w-full"
              />
            </Form.Item>

            <Form.Item
              name="registrationEndDate"
              label="Fim das Inscrições"
              rules={[
                {
                  required: true,
                  message: "Data de fim das inscrições é obrigatória",
                },
              ]}
              validateStatus={
                getFieldError("registrationEndDate") ? "error" : ""
              }
              help={getFieldError("registrationEndDate")}
            >
              <DatePicker
                showTime
                format="DD/MM/YYYY HH:mm"
                placeholder="Fim das inscrições"
                className="w-full"
              />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="maxParticipants"
              label="Número Máximo de Participantes"
              rules={[
                {
                  required: true,
                  message: "Número máximo de participantes é obrigatório",
                },
                {
                  validator: (_, value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 1) {
                      return Promise.reject(
                        "Deve permitir pelo menos 1 participante"
                      );
                    }
                    return Promise.resolve();
                  },
                },
              ]}
              validateStatus={getFieldError("maxParticipants") ? "error" : ""}
              help={getFieldError("maxParticipants")}
            >
              <Input
                type="number"
                placeholder="Número máximo de participantes"
              />
            </Form.Item>

            <Form.Item
              name="price"
              label="Preço"
              rules={[
                { required: true, message: "Preço é obrigatório" },
                {
                  validator: (_, value) => {
                    const num =
                      typeof value === "number" ? value : parseFloat(value);
                    if (isNaN(num) || num < 0) {
                      return Promise.reject(
                        "Preço deve ser maior ou igual a zero"
                      );
                    }
                    return Promise.resolve();
                  },
                },
              ]}
              validateStatus={getFieldError("price") ? "error" : ""}
              help={getFieldError("price")}
            >
              <MoneyInput placeholder="R$ 0,00 (digite 0 para evento gratuito)" />
            </Form.Item>
          </div>

          <Form.Item
            name="bannerUrl"
            label="Banner do Evento"
            validateStatus={getFieldError("bannerUrl") ? "error" : ""}
            help={getFieldError("bannerUrl")}
          >
            <ImageUpload />
          </Form.Item>

          {/* Inscrição Gratuita */}
          <Form.Item
            name="isFree"
            label="Tipo de inscrição"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Gratuita"
              unCheckedChildren="Paga"
              onChange={(checked) => {
                if (checked) {
                  form.setFieldsValue({ price: 0 });
                }
              }}
            />
          </Form.Item>

          {/* Modo do formulário */}
          <Form.Item
            name="formMode"
            label="Modo do formulário de inscrição"
            validateStatus={getFieldError("formMode") ? "error" : ""}
            help={getFieldError("formMode")}
          >
            <Radio.Group>
              <Radio value="FIXED_ONLY">Somente fixo (nome, e-mail, CPF, telefone)</Radio>
              <Radio value="BOTH">Fixo + dinâmico</Radio>
            </Radio.Group>
          </Form.Item>

          {/* Campos obrigatórios - visível apenas em eventos gratuitos */}
          {isFree && (
            <div className="border rounded p-4 mb-4 bg-gray-50">
              <p className="text-sm font-medium mb-3">Campos obrigatórios na inscrição</p>
              <div className="flex gap-6">
                <Form.Item
                  name={["fixedFieldsConfig", "email", "required"]}
                  valuePropName="checked"
                  className="mb-0"
                >
                  <Checkbox>Email obrigatório</Checkbox>
                </Form.Item>
                <Form.Item
                  name={["fixedFieldsConfig", "phone", "required"]}
                  valuePropName="checked"
                  className="mb-0"
                >
                  <Checkbox>Telefone obrigatório</Checkbox>
                </Form.Item>
              </div>
            </div>
          )}

          {/* Formulário Dinâmico */}
          {formMode && formMode !== "FIXED_ONLY" && (
            <Form.Item
              name="dynamicFormFields"
              label="Campos dinâmicos"
              validateStatus={getFieldError("dynamicFormFields") ? "error" : ""}
              help={getFieldError("dynamicFormFields")}
            >
              <DynamicFormBuilder disabled={false} />
            </Form.Item>
          )}

          {/* Configuração de Pagamento (oculta em gratuito) */}
          {!isFree && (
            <Form.Item name="paymentConfig" label="Configuração de Pagamento">
              <PaymentConfigForm
                eventPrice={watchedPrice || 100}
              />
            </Form.Item>
          )}

          <Form.Item name="isActive" label="Status" valuePropName="checked">
            <Switch checkedChildren="Ativo" unCheckedChildren="Inativo" />
          </Form.Item>

          <div className="flex justify-end space-x-2">
            <Button onClick={handleCancel} disabled={loading}>
              Cancelar
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              {editingEvent ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </Form>
      </Modal>
    </ConfigProvider>
  );
}
