"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Button,
  Table,
  Space,
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
import { EventModal } from "../../../components/admin";
import Image from "next/image";

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
    setIsModalVisible(true);
  };

  // Abrir modal para criar
  const handleCreate = () => {
    setEditingEvent(null);
    setIsModalVisible(true);
  };

  // Fechar modal e atualizar lista
  const handleModalSuccess = () => {
    setIsModalVisible(false);
    setEditingEvent(null);
    fetchEvents();
  };

  // Cancelar modal
  const handleModalCancel = () => {
    setIsModalVisible(false);
    setEditingEvent(null);
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

      <EventModal
        visible={isModalVisible}
        editingEvent={editingEvent}
        onCancel={handleModalCancel}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
