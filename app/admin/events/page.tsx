"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Button,
  Table,
  Space,
  Modal,
  Form,
  Input,
  DatePicker,
  Switch,
  message,
  Popconfirm,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { z } from "zod";
import { ImageUpload } from "../../../components/ImageUpload";
import Image from "next/image";

const { TextArea } = Input;

// Schema de validação
const eventSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().min(1, "Descrição é obrigatória"),
  slug: z.string().min(1, "Slug é obrigatório"),
  startDate: z.any(),
  endDate: z.any(),
  registrationStartDate: z.any(),
  registrationEndDate: z.any(),
  location: z.string().min(1, "Local é obrigatório"),
  maxParticipants: z.union([z.string(), z.number()]),
  price: z.union([z.string(), z.number()]),
  bannerUrl: z.string().optional(),
  isActive: z.boolean().default(true),
});

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
  _count?: {
    registrations: number;
  };
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [form] = Form.useForm();

  // Buscar eventos
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/events?includeStats=true");
      const data = await response.json();

      console.log("API Response:", data); // Debug log

      if (data.success) {
        const eventsList = data.data.items || [];
        console.log("Events List:", eventsList); // Debug log
        setEvents(eventsList);
      } else {
        message.error("Erro ao carregar eventos");
      }
    } catch (error) {
      message.error("Erro ao carregar eventos");
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Salvar evento (criar ou editar)
  const handleSave = async (values: z.infer<typeof eventSchema>) => {
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
        setIsModalVisible(false);
        form.resetFields();
        setEditingEvent(null);
        fetchEvents();
      } else {
        message.error(result.error || "Erro ao salvar evento");
      }
    } catch (error) {
      message.error("Erro ao salvar evento");
      console.error("Error saving event:", error);
    }
  };

  // Deletar evento
  const handleDelete = async (eventId: string) => {
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        message.success("Evento deletado com sucesso!");
        fetchEvents();
      } else {
        message.error(result.error || "Erro ao deletar evento");
      }
    } catch (error) {
      message.error("Erro ao deletar evento");
      console.error("Error deleting event:", error);
    }
  };

  // Alternar status ativo
  const toggleActiveStatus = async (eventId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive }),
      });

      const result = await response.json();

      if (result.success) {
        message.success(
          `Evento ${isActive ? "ativado" : "desativado"} com sucesso!`
        );
        fetchEvents();
      } else {
        message.error(result.error || "Erro ao atualizar status do evento");
      }
    } catch (error) {
      message.error("Erro ao atualizar status do evento");
      console.error("Error updating event status:", error);
    }
  };

  // Abrir modal para editar
  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    form.setFieldsValue({
      ...event,
      startDate: dayjs(event.startDate),
      endDate: dayjs(event.endDate),
      registrationStartDate: dayjs(event.registrationStartDate),
      registrationEndDate: dayjs(event.registrationEndDate),
    });
    setIsModalVisible(true);
  };

  // Abrir modal para criar
  const handleCreate = () => {
    setEditingEvent(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  // Fechar modal
  const handleCancel = () => {
    setIsModalVisible(false);
    setEditingEvent(null);
    form.resetFields();
  };

  // Colunas da tabela
  const columns: ColumnsType<Event> = [
    {
      title: "Banner",
      dataIndex: "bannerUrl",
      key: "bannerUrl",
      width: 100,
      render: (bannerUrl: string) => (
        <div className="w-16 h-16 rounded overflow-hidden bg-gray-100">
          {bannerUrl ? (
            <Image
              src={bannerUrl}
              alt="Event"
              className="w-full h-full object-cover"
              width={64}
              height={64}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <EyeOutlined />
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Título",
      dataIndex: "title",
      key: "title",
      sorter: (a, b) => a.title.localeCompare(b.title),
    },
    {
      title: "Slug",
      dataIndex: "slug",
      key: "slug",
      width: 150,
    },
    {
      title: "Local",
      dataIndex: "location",
      key: "location",
    },
    {
      title: "Data do Evento",
      key: "eventDate",
      render: (_, record) => (
        <div>
          <div>{dayjs(record.startDate).format("DD/MM/YYYY HH:mm")}</div>
          <div className="text-gray-500 text-xs">
            até {dayjs(record.endDate).format("DD/MM/YYYY HH:mm")}
          </div>
        </div>
      ),
      sorter: (a, b) => dayjs(a.startDate).unix() - dayjs(b.startDate).unix(),
    },
    {
      title: "Inscrições",
      key: "registrationDate",
      render: (_, record) => (
        <div>
          <div>{dayjs(record.registrationStartDate).format("DD/MM/YYYY")}</div>
          <div className="text-gray-500 text-xs">
            até {dayjs(record.registrationEndDate).format("DD/MM/YYYY")}
          </div>
        </div>
      ),
    },
    {
      title: "Participantes",
      dataIndex: "maxParticipants",
      key: "maxParticipants",
      sorter: (a, b) => a.maxParticipants - b.maxParticipants,
      render: (maxParticipants: number, record) => (
        <div>
          <div>
            {record._count?.registrations || 0} / {maxParticipants}
          </div>
        </div>
      ),
    },
    {
      title: "Preço",
      dataIndex: "price",
      key: "price",
      sorter: (a, b) => a.price - b.price,
      render: (price: number) =>
        price === 0 ? "Gratuito" : `R$ ${price.toFixed(2).replace(".", ",")}`,
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      render: (isActive: boolean, record) => (
        <Switch
          checked={isActive}
          onChange={(checked) => toggleActiveStatus(record.id, checked)}
          checkedChildren="Ativo"
          unCheckedChildren="Inativo"
        />
      ),
    },
    {
      title: "Ações",
      key: "actions",
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Editar">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Tem certeza que deseja deletar este evento?"
            onConfirm={() => handleDelete(record.id)}
            okText="Sim"
            cancelText="Não"
          >
            <Tooltip title="Deletar">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card
        title="Gestão de Eventos"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Novo Evento
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={events}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} de ${total} eventos`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={editingEvent ? "Editar Evento" : "Novo Evento"}
        open={isModalVisible}
        onCancel={handleCancel}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          className="mt-4"
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
              <Input
                type="number"
                placeholder="Número máximo de participantes"
              />
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
            <Button onClick={handleCancel}>Cancelar</Button>
            <Button type="primary" htmlType="submit">
              {editingEvent ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
