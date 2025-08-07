"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  Button,
  Space,
  Tag,
  Popconfirm,
  Form,
  message,
  Typography,
  Input,
  Select,
} from "antd";
import {
  EditOutlined,
  KeyOutlined,
  DeleteOutlined,
  UserAddOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { User, ApiResponse, UserListResponse } from "../../types/user";
import UserModal from "./UserModal";
import { ChangePasswordModal } from "./ChangePasswordModal";

const { Title } = Typography;
const { Option } = Select;

interface UserFormData {
  name: string;
  email: string;
  password?: string;
  role: "ADMIN" | "SUPER_ADMIN";
  isActive: boolean;
}

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Formulários
  const [form] = Form.useForm();

  // Filtros e paginação
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ADMIN" | "SUPER_ADMIN" | "">(
    ""
  );
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "">(
    ""
  );
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // Função para buscar usuários
  const fetchUsers = useCallback(
    async (page = 1, limit = 10) => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          ...(searchInput && { search: searchInput }),
          ...(roleFilter && { role: roleFilter }),
          ...(statusFilter && {
            isActive: (statusFilter === "active").toString(),
          }),
        });

        const response = await fetch(`/api/admin/users?${queryParams}`);
        const result: ApiResponse<UserListResponse> = await response.json();

        if (result.success && result.data) {
          setUsers(result.data.data);
          setPagination({
            current: result.data.pagination.page,
            pageSize: result.data.pagination.limit,
            total: result.data.pagination.total,
          });
        } else {
          throw new Error(result.error || "Erro ao carregar usuários");
        }
      } catch (error) {
        console.error("Error fetching users:", error);
        message.error("Erro ao carregar usuários");
      } finally {
        setLoading(false);
      }
    },
    [searchInput, roleFilter, statusFilter]
  );

  // Efeito para carregar usuários
  useEffect(() => {
    fetchUsers(1, pagination.pageSize);
  }, [searchInput, roleFilter, statusFilter, fetchUsers, pagination.pageSize]);

  // Função para abrir modal de novo usuário
  const handleNewUser = () => {
    setEditingUser(null);
    setIsModalVisible(true);
    form.resetFields();
  };

  // Função para editar usuário
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsModalVisible(true);
    form.setFieldsValue({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
  };

  // Função para alterar senha
  const handleChangePassword = (user: User) => {
    setSelectedUser(user);
    setIsPasswordModalVisible(true);
  };

  // Função para salvar usuário
  const handleSaveUser = async (values: UserFormData) => {
    try {
      const url = editingUser
        ? `/api/admin/users/${editingUser.id}`
        : "/api/admin/users";
      const method = editingUser ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const result: ApiResponse = await response.json();

      if (result.success) {
        message.success(
          editingUser
            ? "Usuário atualizado com sucesso!"
            : "Usuário criado com sucesso!"
        );
        setIsModalVisible(false);
        await fetchUsers(pagination.current, pagination.pageSize);
      } else {
        if (result.details) {
          result.details.forEach((detail) => {
            message.error(detail.message);
          });
        } else {
          message.error(result.error || "Erro ao salvar usuário");
        }
      }
    } catch (error) {
      console.error("Error saving user:", error);
      message.error("Erro ao salvar usuário");
    }
  };

  // Função para alterar senha
  const handlePasswordSubmit = async (data: {
    newPassword: string;
    confirmPassword: string;
  }) => {
    if (!selectedUser) return;

    try {
      const response = await fetch(
        `/api/admin/users/${selectedUser.id}/change-password`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      const result: ApiResponse = await response.json();

      if (result.success) {
        message.success("Senha alterada com sucesso!");
        setIsPasswordModalVisible(false);
      } else {
        if (result.details) {
          result.details.forEach((detail) => {
            message.error(detail.message);
          });
        } else {
          message.error(result.error || "Erro ao alterar senha");
        }
      }
    } catch (error) {
      console.error("Error changing password:", error);
      message.error("Erro ao alterar senha");
    }
  };

  // Função para deletar usuário
  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      const result: ApiResponse = await response.json();

      if (result.success) {
        message.success("Usuário deletado com sucesso!");
        await fetchUsers(pagination.current, pagination.pageSize);
      } else {
        message.error(result.error || "Erro ao deletar usuário");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      message.error("Erro ao deletar usuário");
    }
  };

  // Função para alternar status
  const handleToggleStatus = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/toggle-status`, {
        method: "PUT",
      });

      const result: ApiResponse = await response.json();

      if (result.success) {
        message.success("Status alterado com sucesso!");
        await fetchUsers(pagination.current, pagination.pageSize);
      } else {
        message.error(result.error || "Erro ao alterar status");
      }
    } catch (error) {
      console.error("Error toggling user status:", error);
      message.error("Erro ao alterar status do usuário");
    }
  };

  // Colunas da tabela
  const columns = [
    {
      title: "Nome",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: User) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-sm text-gray-500">{record.email}</div>
        </div>
      ),
    },
    {
      title: "Função",
      dataIndex: "role",
      key: "role",
      render: (role: string) => (
        <Tag color={role === "SUPER_ADMIN" ? "purple" : "blue"}>
          {role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      render: (isActive: boolean) => (
        <Tag color={isActive ? "green" : "red"}>
          {isActive ? "Ativo" : "Inativo"}
        </Tag>
      ),
    },
    {
      title: "Último Login",
      dataIndex: "lastLoginAt",
      key: "lastLoginAt",
      render: (date: string | null) => {
        if (!date) return "Nunca";
        return new Date(date).toLocaleString("pt-BR");
      },
    },
    {
      title: "Criado em",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string) => new Date(date).toLocaleString("pt-BR"),
    },
    {
      title: "Ações",
      key: "actions",
      render: (_: unknown, record: User) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditUser(record)}
          >
            Editar
          </Button>
          <Button
            type="link"
            icon={<KeyOutlined />}
            onClick={() => handleChangePassword(record)}
          >
            Senha
          </Button>
          <Button type="link" onClick={() => handleToggleStatus(record.id)}>
            {record.isActive ? "Desativar" : "Ativar"}
          </Button>
          <Popconfirm
            title="Tem certeza que deseja deletar este usuário?"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="Sim"
            cancelText="Não"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              Deletar
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-6">
        <Title level={2}>
          <UserAddOutlined className="mr-3" />
          Gerenciar Usuários
        </Title>
        <Button
          type="primary"
          icon={<UserAddOutlined />}
          onClick={handleNewUser}
        >
          Novo Usuário
        </Button>
      </div>

      {/* Filtros */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Input.Search
          placeholder="Buscar por nome ou email..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          allowClear
        />

        <Select
          placeholder="Filtrar por função"
          value={roleFilter}
          onChange={setRoleFilter}
          allowClear
        >
          <Option value="ADMIN">Admin</Option>
          <Option value="SUPER_ADMIN">Super Admin</Option>
        </Select>

        <Select
          placeholder="Filtrar por status"
          value={statusFilter}
          onChange={setStatusFilter}
          allowClear
        >
          <Option value="active">Ativo</Option>
          <Option value="inactive">Inativo</Option>
        </Select>

        <Button
          icon={<ReloadOutlined />}
          onClick={() => fetchUsers(pagination.current, pagination.pageSize)}
        >
          Atualizar
        </Button>
      </div>

      {/* Tabela */}
      <Table
        columns={columns}
        dataSource={users}
        loading={loading}
        rowKey="id"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} de ${total} usuários`,
        }}
        onChange={(pag) => {
          if (pag.current && pag.pageSize) {
            fetchUsers(pag.current, pag.pageSize);
          }
        }}
      />

      {/* Modal de Usuário */}
      <UserModal
        isVisible={isModalVisible}
        editingUser={editingUser}
        form={form}
        onCancel={() => setIsModalVisible(false)}
        onSave={handleSaveUser}
      />

      {/* Modal de Alterar Senha */}
      <ChangePasswordModal
        isOpen={isPasswordModalVisible}
        onClose={() => setIsPasswordModalVisible(false)}
        onSubmit={handlePasswordSubmit}
        userName={selectedUser?.name || ""}
      />
    </div>
  );
};
