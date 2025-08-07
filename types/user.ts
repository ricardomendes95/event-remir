export interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SUPER_ADMIN";
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role?: "ADMIN" | "SUPER_ADMIN";
  isActive?: boolean;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: "ADMIN" | "SUPER_ADMIN";
  isActive?: boolean;
}

export interface ChangePasswordData {
  newPassword: string;
  confirmPassword: string;
}

export interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  role?: "ADMIN" | "SUPER_ADMIN";
  isActive?: boolean;
}

export interface UserListResponse {
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: Array<{
    code: string;
    expected?: unknown;
    received?: unknown;
    path: Array<string | number>;
    message: string;
  }>;
}
