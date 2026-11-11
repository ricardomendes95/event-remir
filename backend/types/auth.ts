import type { AdminRole } from "@/lib/permissions";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

export interface JWTPayload {
  id: string;
  email: string;
  name?: string;
  role: AdminRole;
  iat?: number;
  exp?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
  expiresIn: string;
}
