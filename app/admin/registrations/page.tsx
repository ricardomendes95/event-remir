"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Form, message, Typography } from "antd";
import { UserAddOutlined } from "@ant-design/icons";
import { z } from "zod";
import AdminHeader from "../components/AdminHeader";
import {
  RegistrationStats,
  RegistrationFilters,
  RegistrationTable,
  RegistrationModal,
  registrationSchema,
} from "../../../components/admin/registrations";

const { Title, Text } = Typography;

interface Registration {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
  event: {
    id: string;
    title: string;
    price: number;
    startDate: string;
  };
}

interface Event {
  id: string;
  title: string;
  price: number;
  startDate: string;
  isActive: boolean;
}

interface RegistrationFormData {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  eventId: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
}

export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRegistration, setEditingRegistration] =
    useState<Registration | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState("");
  const [searchInput, setSearchInput] = useState(""); // input do usuário
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [eventFilter, setEventFilter] = useState<string>("ALL");
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) =>
      `${range[0]}-${range[1]} de ${total} inscrições`,
  });
  const [stats, setStats] = useState({
    total: 0,
    confirmed: 0,
    pending: 0,
    cancelled: 0,
    totalRevenue: 0,
  });

  // Buscar estatísticas
  const fetchStats = useCallback(async () => {
    try {
      // Construir parâmetros da query (apenas filtros de status e evento, não search)
      const params = new URLSearchParams();

      if (statusFilter !== "ALL") {
        params.append("status", statusFilter);
      }
      if (eventFilter !== "ALL") {
        params.append("eventId", eventFilter);
      }
      // Não incluir search - estatísticas devem ignorar a busca

      const response = await fetch(`/api/registrations/stats?${params}`);
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, [statusFilter, eventFilter]); // Removido searchText das dependências

  // Buscar inscrições
  const fetchRegistrations = useCallback(
    async (page = 1, pageSize = 10) => {
      setLoading(true);
      try {
        // Construir parâmetros da query
        const params = new URLSearchParams({
          page: page.toString(),
          limit: pageSize.toString(),
        });

        if (statusFilter !== "ALL") {
          params.append("status", statusFilter);
        }
        if (eventFilter !== "ALL") {
          params.append("eventId", eventFilter);
        }
        if (searchText.trim()) {
          params.append("search", searchText.trim());
        }

        const response = await fetch(`/api/registrations?${params}`);
        const data = await response.json();

        if (data.success) {
          const registrationsList = data.data.items || [];
          setRegistrations(registrationsList);

          // Atualizar paginação
          setPagination((prev) => ({
            ...prev,
            current: data.data.pagination.page,
            total: data.data.pagination.total,
            pageSize: data.data.pagination.limit,
          }));
        } else {
          message.error("Erro ao carregar inscrições");
        }
      } catch (error) {
        message.error("Erro ao carregar inscrições");
        console.error("Error fetching registrations:", error);
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, eventFilter, searchText]
  );

  // Buscar eventos para o filtro e formulário
  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch("/api/events");
      const data = await response.json();

      if (data.success) {
        setEvents(data.data.items || []);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
    }
  }, []);

  useEffect(() => {
    fetchRegistrations(1, 10); // página inicial
    fetchStats(); // buscar estatísticas iniciais
    fetchEvents();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce para o search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchText(searchInput);
    }, 500); // 500ms de delay

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Quando filtros mudam, buscar nova página
  useEffect(() => {
    fetchRegistrations(1, pagination.pageSize);
  }, [
    statusFilter,
    eventFilter,
    searchText,
    fetchRegistrations,
    pagination.pageSize,
  ]);

  // Atualizar estatísticas apenas quando filtros de status ou evento mudarem
  useEffect(() => {
    fetchStats();
  }, [statusFilter, eventFilter, fetchStats]);

  // Função para formatar CPF
  const formatCPF = (value: string) => {
    const cpf = value.replace(/\D/g, "");
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  // Função para formatar telefone
  const formatPhone = (value: string) => {
    const phone = value.replace(/\D/g, "");
    if (phone.length <= 10) {
      return phone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };

  // Abrir modal para nova inscrição
  const handleNewRegistration = () => {
    setEditingRegistration(null);
    setIsModalVisible(true);
    form.resetFields();
  };

  // Abrir modal para edição
  const handleEditRegistration = (registration: Registration) => {
    setEditingRegistration(registration);
    setIsModalVisible(true);
    form.setFieldsValue({
      ...registration,
      cpf: formatCPF(registration.cpf),
      phone: formatPhone(registration.phone),
    });
  };

  // Função para lidar com mudanças na paginação da tabela
  const handleTableChange = (pag: { current?: number; pageSize?: number }) => {
    if (pag.current && pag.pageSize) {
      fetchRegistrations(pag.current, pag.pageSize);
    }
  };

  // Salvar inscrição (criar ou editar)
  const handleSaveRegistration = async (values: RegistrationFormData) => {
    try {
      const cleanValues = {
        ...values,
        cpf: values.cpf.replace(/\D/g, ""),
        phone: values.phone.replace(/\D/g, ""),
      };

      // Validar com Zod
      registrationSchema.parse(cleanValues);

      const url = editingRegistration
        ? `/api/registrations/${editingRegistration.id}`
        : "/api/registrations";

      const method = editingRegistration ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanValues),
      });

      const data = await response.json();

      if (data.success) {
        message.success(
          editingRegistration ? "Inscrição atualizada!" : "Inscrição criada!"
        );
        setIsModalVisible(false);
        fetchRegistrations(pagination.current, pagination.pageSize);
        fetchStats(); // atualizar estatísticas
      } else {
        message.error(data.error || "Erro ao salvar inscrição");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.issues.forEach((issue) => {
          message.error(issue.message);
        });
      } else {
        message.error("Erro ao salvar inscrição");
      }
    }
  };

  // Excluir inscrição
  const handleDeleteRegistration = async (registrationId: string) => {
    try {
      const response = await fetch(`/api/registrations/${registrationId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        message.success("Inscrição excluída!");
        fetchRegistrations(pagination.current, pagination.pageSize);
        fetchStats(); // atualizar estatísticas
      } else {
        message.error(data.error || "Erro ao excluir inscrição");
      }
    } catch (error: unknown) {
      console.error("Error deleting registration:", error);
      message.error("Erro ao excluir inscrição");
    }
  };

  // Alterar status da inscrição
  const handleChangeStatus = async (
    registrationId: string,
    newStatus: string
  ) => {
    try {
      const response = await fetch(`/api/registrations/${registrationId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (data.success) {
        message.success("Status atualizado!");
        fetchRegistrations(pagination.current, pagination.pageSize);
        fetchStats(); // atualizar estatísticas
      } else {
        message.error(data.error || "Erro ao atualizar status");
      }
    } catch (error: unknown) {
      console.error("Error changing status:", error);
      message.error("Erro ao atualizar status");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Title level={2}>
            <UserAddOutlined className="mr-3" />
            Gestão de Inscrições
          </Title>
          <Text type="secondary">Gerencie todas as inscrições dos eventos</Text>
        </div>

        {/* Estatísticas */}
        <RegistrationStats stats={stats} />

        {/* Filtros e Busca */}
        <RegistrationFilters
          searchInput={searchInput}
          statusFilter={statusFilter}
          eventFilter={eventFilter}
          events={events}
          onSearchChange={setSearchInput}
          onStatusChange={setStatusFilter}
          onEventChange={setEventFilter}
          onRefresh={() => {
            fetchRegistrations(pagination.current, pagination.pageSize);
            fetchStats();
          }}
        />

        {/* Tabela */}
        <RegistrationTable
          registrations={registrations}
          loading={loading}
          pagination={pagination}
          onTableChange={handleTableChange}
          onNewRegistration={handleNewRegistration}
          onEditRegistration={handleEditRegistration}
          onChangeStatus={handleChangeStatus}
          onDeleteRegistration={handleDeleteRegistration}
        />

        {/* Modal de Criar/Editar Inscrição */}
        <RegistrationModal
          isVisible={isModalVisible}
          editingRegistration={editingRegistration}
          events={events}
          form={form}
          onCancel={() => setIsModalVisible(false)}
          onSave={handleSaveRegistration}
        />
      </div>
    </div>
  );
}
