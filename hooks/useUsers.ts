import { useState, useCallback } from "react";
import {
  User,
  CreateUserData,
  UpdateUserData,
  ChangePasswordData,
  UserFilters,
  ApiResponse,
  UserListResponse,
} from "../types/user";

export interface UseUsersReturn {
  users: User[];
  loading: boolean;
  error: string | null;
  totalPages: number;
  currentPage: number;
  fetchUsers: (filters: UserFilters) => Promise<void>;
  createUser: (data: CreateUserData) => Promise<void>;
  updateUser: (id: string, data: UpdateUserData) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  changePassword: (id: string, data: ChangePasswordData) => Promise<void>;
  toggleUserStatus: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useUsers = (): UseUsersReturn => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleApiError = useCallback(
    (error: unknown, defaultMessage: string) => {
      console.error(error);
      if (error && typeof error === "object" && "message" in error) {
        setError((error as Error).message);
      } else {
        setError(defaultMessage);
      }
    },
    []
  );

  const fetchUsers = useCallback(
    async (filters: UserFilters) => {
      setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams({
          page: filters.page?.toString() || "1",
          limit: filters.limit?.toString() || "10",
          ...(filters.search && { search: filters.search }),
          ...(filters.role && { role: filters.role }),
          ...(filters.isActive !== undefined && {
            isActive: filters.isActive.toString(),
          }),
        });

        const response = await fetch(`/api/admin/users?${queryParams}`);

        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }

        const result: ApiResponse<UserListResponse> = await response.json();

        if (result.success && result.data) {
          setUsers(result.data.data);
          setTotalPages(result.data.pagination.totalPages);
          setCurrentPage(result.data.pagination.page);
        } else {
          throw new Error(result.error || "Erro ao carregar usuários");
        }
      } catch (error) {
        handleApiError(error, "Erro ao carregar usuários");
      } finally {
        setLoading(false);
      }
    },
    [handleApiError]
  );

  const createUser = useCallback(
    async (data: CreateUserData) => {
      setError(null);

      try {
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }

        const result: ApiResponse = await response.json();

        if (!result.success) {
          if (result.details) {
            const errorMessages = result.details
              .map((detail) => detail.message)
              .join(", ");
            throw new Error(errorMessages);
          }
          throw new Error(result.error || "Erro ao criar usuário");
        }
      } catch (error) {
        handleApiError(error, "Erro ao criar usuário");
        throw error; // Re-throw para permitir tratamento específico no componente
      }
    },
    [handleApiError]
  );

  const updateUser = useCallback(
    async (id: string, data: UpdateUserData) => {
      setError(null);

      try {
        const response = await fetch(`/api/admin/users/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }

        const result: ApiResponse = await response.json();

        if (!result.success) {
          if (result.details) {
            const errorMessages = result.details
              .map((detail) => detail.message)
              .join(", ");
            throw new Error(errorMessages);
          }
          throw new Error(result.error || "Erro ao atualizar usuário");
        }
      } catch (error) {
        handleApiError(error, "Erro ao atualizar usuário");
        throw error; // Re-throw para permitir tratamento específico no componente
      }
    },
    [handleApiError]
  );

  const deleteUser = useCallback(
    async (id: string) => {
      setError(null);

      try {
        const response = await fetch(`/api/admin/users/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }

        const result: ApiResponse = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Erro ao deletar usuário");
        }
      } catch (error) {
        handleApiError(error, "Erro ao deletar usuário");
        throw error; // Re-throw para permitir tratamento específico no componente
      }
    },
    [handleApiError]
  );

  const changePassword = useCallback(
    async (id: string, data: ChangePasswordData) => {
      setError(null);

      try {
        const response = await fetch(`/api/admin/users/${id}/change-password`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }

        const result: ApiResponse = await response.json();

        if (!result.success) {
          if (result.details) {
            const errorMessages = result.details
              .map((detail) => detail.message)
              .join(", ");
            throw new Error(errorMessages);
          }
          throw new Error(result.error || "Erro ao alterar senha");
        }
      } catch (error) {
        handleApiError(error, "Erro ao alterar senha");
        throw error; // Re-throw para permitir tratamento específico no componente
      }
    },
    [handleApiError]
  );

  const toggleUserStatus = useCallback(
    async (id: string) => {
      setError(null);

      try {
        const response = await fetch(`/api/admin/users/${id}/toggle-status`, {
          method: "PUT",
        });

        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }

        const result: ApiResponse = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Erro ao alterar status do usuário");
        }
      } catch (error) {
        handleApiError(error, "Erro ao alterar status do usuário");
        throw error; // Re-throw para permitir tratamento específico no componente
      }
    },
    [handleApiError]
  );

  return {
    users,
    loading,
    error,
    totalPages,
    currentPage,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    changePassword,
    toggleUserStatus,
    clearError,
  };
};
