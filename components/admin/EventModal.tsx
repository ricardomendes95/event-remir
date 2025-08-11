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
} from "antd";
import dayjs from "dayjs";
import locale from "antd/locale/pt_BR";
import "dayjs/locale/pt-br";
import { ImageUpload } from "../ImageUpload";
import { MoneyInput } from "../MoneyInput";
import RichTextEditor from "../RichTextEditor";
import { PaymentConfigForm } from "./PaymentConfigForm";
import {
  useEventValidation,
  EventFormData,
} from "../../hooks/useEventValidation";
import { generateSlug } from "../../utils/slugUtils";
import { PaymentConfig } from "@/backend/schemas/eventSchemas";

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
  paymentConfig?: PaymentConfig;
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
      });
      clearErrors();
    } else if (visible && !editingEvent) {
      form.resetFields();
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
      const eventData = {
        ...values,
        startDate: dayjs(values.startDate).toISOString(),
        endDate: dayjs(values.endDate).toISOString(),
        registrationStartDate: dayjs(
          values.registrationStartDate
        ).toISOString(),
        registrationEndDate: dayjs(values.registrationEndDate).toISOString(),
        maxParticipants: parseInt(values.maxParticipants.toString()),
        price: parseFloat(values.price.toString()),
        bannerUrl: values.bannerUrl || undefined,
        paymentConfig: values.paymentConfig || undefined,
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
    // Só gera slug automaticamente se estamos criando um novo evento e o slug está vazio
    if (!editingEvent && !form.getFieldValue("slug")) {
      form.setFieldValue("slug", generateSlug(title));
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
            <ImageUpload
              value={form.getFieldValue("bannerUrl")}
              onChange={(url) => form.setFieldsValue({ bannerUrl: url })}
            />
          </Form.Item>

          <Form.Item name="paymentConfig" label="Configuração de Pagamento">
            <PaymentConfigForm
              value={form.getFieldValue("paymentConfig")}
              onChange={(config: PaymentConfig) =>
                form.setFieldsValue({ paymentConfig: config })
              }
              eventPrice={form.getFieldValue("price") || 100}
            />
          </Form.Item>

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
