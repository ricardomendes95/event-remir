"use client";

import React from "react";
import { Modal, Form, Input, DatePicker, Switch, Button, message } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { ImageUpload } from "../ImageUpload";

const { TextArea } = Input;

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
}

interface EventFormValues {
  title: string;
  description: string;
  slug: string;
  startDate: Dayjs;
  endDate: Dayjs;
  registrationStartDate: Dayjs;
  registrationEndDate: Dayjs;
  location: string;
  maxParticipants: string | number;
  price: string | number;
  bannerUrl?: string;
  isActive: boolean;
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
    } else if (visible && !editingEvent) {
      form.resetFields();
    }
  }, [visible, editingEvent, form]);

  // Salvar evento (criar ou editar)
  const handleSave = async (values: EventFormValues) => {
    setLoading(true);
    try {
      // Validação customizada
      const maxParticipants = parseInt(values.maxParticipants.toString());
      const price = parseFloat(values.price.toString());

      if (isNaN(maxParticipants) || maxParticipants <= 0) {
        message.error("Número máximo de participantes deve ser maior que 0");
        return;
      }

      if (isNaN(price) || price < 0) {
        message.error("Preço deve ser maior ou igual a 0");
        return;
      }

      const eventData = {
        ...values,
        startDate: dayjs(values.startDate).toISOString(),
        endDate: dayjs(values.endDate).toISOString(),
        registrationStartDate: dayjs(
          values.registrationStartDate
        ).toISOString(),
        registrationEndDate: dayjs(values.registrationEndDate).toISOString(),
        maxParticipants,
        price,
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
        onSuccess();
      } else {
        message.error(result.error || "Erro ao salvar evento");
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
    onCancel();
  };

  return (
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
          rules={[{ required: true, message: "Título é obrigatório" }]}
        >
          <Input placeholder="Título do evento" />
        </Form.Item>

        <Form.Item
          name="slug"
          label="Slug (URL amigável)"
          rules={[{ required: true, message: "Slug é obrigatório" }]}
        >
          <Input placeholder="evento-exemplo" />
        </Form.Item>

        <Form.Item
          name="description"
          label="Descrição"
          rules={[{ required: true, message: "Descrição é obrigatória" }]}
        >
          <TextArea rows={4} placeholder="Descrição do evento" />
        </Form.Item>

        <Form.Item
          name="location"
          label="Local"
          rules={[{ required: true, message: "Local é obrigatório" }]}
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
            ]}
          >
            <Input type="number" placeholder="Número máximo de participantes" />
          </Form.Item>

          <Form.Item
            name="price"
            label="Preço (R$)"
            rules={[{ required: true, message: "Preço é obrigatório" }]}
          >
            <Input
              type="number"
              step="0.01"
              placeholder="0.00 (digite 0 para evento gratuito)"
            />
          </Form.Item>
        </div>

        <Form.Item name="bannerUrl" label="Banner do Evento">
          <ImageUpload
            value={form.getFieldValue("bannerUrl")}
            onChange={(url) => form.setFieldsValue({ bannerUrl: url })}
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
  );
}
