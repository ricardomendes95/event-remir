import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export const TokenSchema = z.object({
  token: z.string(),
});

export const AdminCreateSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
});

export type LoginData = z.infer<typeof LoginSchema>;
export type TokenData = z.infer<typeof TokenSchema>;
export type AdminCreateData = z.infer<typeof AdminCreateSchema>;
