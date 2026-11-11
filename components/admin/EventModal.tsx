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
  Space,
  InputNumber,
} from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import locale from "antd/locale/pt_BR";
import "dayjs/locale/pt-br";
import { ImageUpload } from "../ImageUpload";
import { MoneyInput } from "../MoneyInput";
import RichTextEditor from "../RichTextEditor";
import { DynamicFormBuilder } from "./DynamicFormBuilder";
import {
  useEventValidation,
  serializeBatches,
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
  allowBatchRegistration?: boolean;
  formMode?: "FIXED_ONLY" | "DYNAMIC_ONLY" | "BOTH";
  dynamicFormFields?: DynamicField[];
  fixedFieldsConfig?: {
    email?: { required: boolean };
    phone?: { required: boolean };
  };
  paymentConfig?: PaymentConfig;
  shirtConfig?: { enabled: boolean; priceWithShirt: number; sizes: string[] };
  batches?: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    quota: number | null;
    priority: number;
    price: number;
    priceWithShirt: number | null;
    isActive: boolean;
  }[];
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
  const slugManuallyEdited = React.useRef(false);
  const {
    validationErrors,
    validateFormData,
    setApiErrors,
    clearErrors,
    getFieldError,
  } = useEventValidation();

  const isFree = Form.useWatch("isFree", form) as boolean | undefined;
  const formMode = Form.useWatch("formMode", form) as
    "FIXED_ONLY" | "DYNAMIC_ONLY" | "BOTH" | undefined;
  const watchedPrice = Form.useWatch("price", form) as number | undefined;
  const shirtEnabled = Form.useWatch(["shirtConfig", "enabled"], form) as
    boolean | undefined;

  const batchErrors = Object.entries(validationErrors)
    .filter(([field]) => field === "batches" || field.startsWith("batches."))
    .map(([, msg]) => msg);

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
        allowBatchRegistration: editingEvent.allowBatchRegistration ?? false,
        formMode: editingEvent.formMode ?? "FIXED_ONLY",
        dynamicFormFields: editingEvent.dynamicFormFields ?? [],
        batches: (editingEvent.batches ?? []).map((b) => ({
          id: b.id,
          name: b.name,
          period: [dayjs(b.startDate), dayjs(b.endDate)],
          quota: b.quota,
          priority: b.priority,
          price: b.price,
          priceWithShirt: b.priceWithShirt,
          isActive: b.isActive,
        })),
        shirtConfig: editingEvent.shirtConfig ?? {
          enabled: false,
          priceWithShirt: 0,
          sizes: [],
        },
      });
      clearErrors();
    } else if (visible && !editingEvent) {
      form.resetFields();
      form.setFieldsValue({
        isFree: false,
        allowBatchRegistration: false,
        formMode: "FIXED_ONLY",
      });
      slugManuallyEdited.current = false;
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
          values.registrationStartDate,
        ).toISOString(),
        registrationEndDate: dayjs(values.registrationEndDate).toISOString(),
        maxParticipants: parseInt(values.maxParticipants.toString()),
        price: isFreeVal ? 0 : parseFloat(values.price.toString()),
        bannerUrl: values.bannerUrl || undefined,
        paymentConfig: isFreeVal
          ? undefined
          : values.paymentConfig || undefined,
        // Camisa só vale para evento pago e quando habilitada
        shirtConfig:
          !isFreeVal && values.shirtConfig?.enabled
            ? {
                enabled: true,
                priceWithShirt: parseFloat(
                  values.shirtConfig.priceWithShirt?.toString() || "0",
                ),
                sizes: (values.shirtConfig.sizes ?? [])
                  .map((s) => (s ?? "").toString().trim())
                  .filter(Boolean),
              }
            : undefined,
        batches: isFreeVal
          ? undefined
          : serializeBatches(values.batches, !!values.shirtConfig?.enabled),
        isFree: isFreeVal,
        allowBatchRegistration: !!values.allowBatchRegistration,
        formMode: formModeVal,
        dynamicFormFields:
          formModeVal === "FIXED_ONLY"
            ? undefined
            : (values.dynamicFormFields ?? []),
        fixedFieldsConfig: isFreeVal
          ? {
              email: { required: !!values.fixedFieldsConfig?.email?.required },
              phone: { required: !!values.fixedFieldsConfig?.phone?.required },
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
            : "Evento criado com sucesso!",
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
    if (!editingEvent && !slugManuallyEdited.current) {
      form.setFieldValue("slug", generateSlug(title));
    }
  };

  const handleSlugChange = () => {
    slugManuallyEdited.current = true;
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
            <Input placeholder="evento-exemplo" onChange={handleSlugChange} />
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
          <Form.Item
            shouldUpdate={(prev, curr) => prev.location !== curr.location}
            noStyle
          >
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
                        "Deve permitir pelo menos 1 participante",
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
                        "Preço deve ser maior ou igual a zero",
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

          {/* Inscrição em grupo */}
          <Form.Item
            name="allowBatchRegistration"
            label="Inscrição em grupo"
            valuePropName="checked"
            extra="Permite que uma pessoa inscreva até 10 participantes em uma única compra. O fluxo individual continua disponível."
          >
            <Switch checkedChildren="Permitida" unCheckedChildren="Desativada" />
          </Form.Item>

          {/* Modo do formulário */}
          <Form.Item
            name="formMode"
            label="Modo do formulário de inscrição"
            validateStatus={getFieldError("formMode") ? "error" : ""}
            help={getFieldError("formMode")}
          >
            <Radio.Group>
              <Radio value="FIXED_ONLY">
                Somente fixo (nome, e-mail, CPF, telefone)
              </Radio>
              <Radio value="BOTH">Fixo + dinâmico</Radio>
            </Radio.Group>
          </Form.Item>

          {/* Campos obrigatórios - visível apenas em eventos gratuitos */}
          {isFree && (
            <div className="border rounded p-4 mb-4 bg-gray-50">
              <p className="text-sm font-medium mb-3">
                Campos obrigatórios na inscrição
              </p>
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

          {/* Pagamento via InfinitePay: o participante paga com Pix ou cartão de
              crédito (até 12x) no checkout do InfinitePay. As taxas/parcelamento
              são definidas na conta InfinitePay — não há configuração por evento. */}
          {!isFree && (
            <Alert
              type="info"
              showIcon
              className="mb-4"
              message="Pagamento via InfinitePay"
              description="O participante paga com Pix (na hora) ou cartão de crédito em até 12x no checkout do InfinitePay. Defina apenas o valor da inscrição acima."
            />
          )}

          {/* Camisa do evento (apenas evento pago) */}
          {!isFree && (
            <div className="border rounded p-4 mb-4 bg-gray-50">
              <p className="text-sm font-medium mb-1">Camisa do evento</p>
              <p className="text-xs text-gray-500 mb-3">
                O participante poderá escolher se inscrever com ou sem camisa.
                Se escolher com camisa, será obrigatório informar o tamanho.
              </p>

              <Form.Item
                name={["shirtConfig", "enabled"]}
                valuePropName="checked"
                className="mb-2"
              >
                <Switch
                  checkedChildren="Oferece camisa"
                  unCheckedChildren="Sem camisa"
                  disabled={hasRegistrations}
                />
              </Form.Item>

              {hasRegistrations && (
                <Alert
                  type="info"
                  showIcon
                  className="mb-3"
                  message="Este evento já possui inscrições. A configuração de camisa não pode ser alterada para não afetar os relatórios."
                />
              )}

              {shirtEnabled && (
                <>
                  <Form.Item
                    name={["shirtConfig", "priceWithShirt"]}
                    label="Valor da inscrição COM camisa"
                    tooltip="Deve ser maior que o valor da inscrição sem camisa."
                    rules={[
                      {
                        required: true,
                        message: "Informe o valor com camisa",
                      },
                      {
                        validator: (_, value) => {
                          const num =
                            typeof value === "number"
                              ? value
                              : parseFloat(value);
                          const base =
                            typeof watchedPrice === "number"
                              ? watchedPrice
                              : parseFloat(String(watchedPrice ?? 0));
                          if (isNaN(num) || num <= 0) {
                            return Promise.reject("Valor inválido");
                          }
                          if (num <= base) {
                            return Promise.reject(
                              `Deve ser maior que o valor sem camisa (R$ ${(
                                base || 0
                              ).toFixed(2)})`,
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <MoneyInput placeholder="R$ 0,00" />
                  </Form.Item>

                  <label className="text-sm font-medium block mb-2">
                    Tamanhos disponíveis
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Ex.: P, M, G, GG. O participante escolherá um destes.
                  </p>
                  <Form.List name={["shirtConfig", "sizes"]}>
                    {(fields, { add, remove }) => (
                      <div>
                        {fields.map((field) => (
                          <Space
                            key={field.key}
                            style={{ display: "flex", marginBottom: 8 }}
                            align="baseline"
                          >
                            <Form.Item
                              {...field}
                              className="mb-0"
                              rules={[
                                {
                                  required: true,
                                  message: "Informe o tamanho",
                                },
                              ]}
                            >
                              <Input
                                placeholder="Ex: P"
                                style={{ width: 160 }}
                                disabled={hasRegistrations}
                              />
                            </Form.Item>
                            {!hasRegistrations && (
                              <MinusCircleOutlined
                                onClick={() => remove(field.name)}
                              />
                            )}
                          </Space>
                        ))}
                        {!hasRegistrations && (
                          <Button
                            type="dashed"
                            onClick={() => add("")}
                            block
                            icon={<PlusOutlined />}
                          >
                            Adicionar tamanho
                          </Button>
                        )}
                      </div>
                    )}
                  </Form.List>
                </>
              )}
            </div>
          )}

          {/* Lotes de inscrição (apenas evento pago) */}
          {!isFree && (
            <div className="border rounded p-4 mb-4 bg-gray-50">
              <p className="text-sm font-medium mb-1">Lotes de inscrição</p>
              <p className="text-xs text-gray-500 mb-3">
                Opcional. Sem lotes, vale o valor único da inscrição. Com lotes,
                cada um tem seu valor e período; quando acaba o prazo ou as
                vagas do lote, passa a valer o próximo (menor ordem primeiro). O
                limite de participantes do evento sempre vale.
              </p>

              {batchErrors.length > 0 && (
                <Alert
                  type="error"
                  showIcon
                  className="mb-3"
                  message={batchErrors.join(" · ")}
                />
              )}

              <Form.List name="batches">
                {(fields, { add, remove }) => (
                  <div className="flex flex-col gap-3">
                    {fields.map((field, index) => (
                      <div
                        key={field.key}
                        className="border rounded p-3 bg-white"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">
                            Lote {index + 1}
                          </span>
                          <Button
                            type="text"
                            danger
                            icon={<MinusCircleOutlined />}
                            onClick={() => remove(field.name)}
                          >
                            Remover
                          </Button>
                        </div>

                        <Form.Item name={[field.name, "id"]} hidden>
                          <Input />
                        </Form.Item>

                        <Form.Item
                          name={[field.name, "name"]}
                          label="Nome do lote"
                          rules={[
                            {
                              required: true,
                              message: "Informe o nome do lote",
                            },
                          ]}
                        >
                          <Input placeholder="Ex: 1º Lote" maxLength={60} />
                        </Form.Item>

                        <Form.Item
                          name={[field.name, "period"]}
                          label="Período em que o lote vale"
                          rules={[
                            { required: true, message: "Informe o período" },
                          ]}
                        >
                          <DatePicker.RangePicker
                            showTime
                            format="DD/MM/YYYY HH:mm"
                            className="w-full"
                            placeholder={["Início", "Fim"]}
                          />
                        </Form.Item>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                          <Form.Item
                            name={[field.name, "price"]}
                            label="Valor sem camisa"
                            rules={[
                              { required: true, message: "Informe o valor" },
                            ]}
                          >
                            <MoneyInput placeholder="R$ 0,00" />
                          </Form.Item>

                          {shirtEnabled && (
                            <Form.Item
                              name={[field.name, "priceWithShirt"]}
                              label="Valor com camisa"
                              dependencies={[["batches", field.name, "price"]]}
                              rules={[
                                {
                                  required: true,
                                  message: "Informe o valor com camisa",
                                },
                                ({ getFieldValue }) => ({
                                  validator: (_, value) => {
                                    const base = Number(
                                      getFieldValue([
                                        "batches",
                                        field.name,
                                        "price",
                                      ]) ?? 0,
                                    );
                                    if (Number(value) <= base) {
                                      return Promise.reject(
                                        "Deve ser maior que o valor sem camisa",
                                      );
                                    }
                                    return Promise.resolve();
                                  },
                                }),
                              ]}
                            >
                              <MoneyInput placeholder="R$ 0,00" />
                            </Form.Item>
                          )}

                          <Form.Item
                            name={[field.name, "quota"]}
                            label="Vagas do lote (opcional)"
                            tooltip="Deixe vazio para não limitar as vagas deste lote."
                          >
                            <InputNumber
                              min={1}
                              precision={0}
                              inputMode="numeric"
                              className="w-full"
                              placeholder="Sem limite"
                            />
                          </Form.Item>

                          <Form.Item
                            name={[field.name, "priority"]}
                            label="Ordem de uso"
                            tooltip="Se dois lotes valerem ao mesmo tempo, vale o de menor número."
                          >
                            <InputNumber
                              min={0}
                              precision={0}
                              inputMode="numeric"
                              className="w-full"
                            />
                          </Form.Item>
                        </div>

                        <Form.Item
                          name={[field.name, "isActive"]}
                          valuePropName="checked"
                          className="mb-0"
                        >
                          <Switch
                            checkedChildren="Lote ativo"
                            unCheckedChildren="Lote desativado"
                          />
                        </Form.Item>
                      </div>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() =>
                        add({
                          isActive: true,
                          priority: fields.length + 1,
                        })
                      }
                      block
                      icon={<PlusOutlined />}
                    >
                      Adicionar lote
                    </Button>
                  </div>
                )}
              </Form.List>
            </div>
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
