export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "SUPER_ADMIN";
}

export interface JWTPayload {
  id: string;
  email: string;
  role: "ADMIN" | "SUPER_ADMIN";
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
