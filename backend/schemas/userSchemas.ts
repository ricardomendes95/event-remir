import { z } from "zod";

// Schema para criar usuário
export const createUserSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  email: z.string().email("Email inválido").toLowerCase(),
  password: z
    .string()
    .min(6, "Senha deve ter pelo menos 6 caracteres")
    .max(100, "Senha deve ter no máximo 100 caracteres"),
  role: z.enum(["ADMIN", "SUPER_ADMIN"]).default("ADMIN"),
  isActive: z.boolean().default(true),
});

// Schema para atualizar usuário (todos os campos são opcionais)
export const updateUserSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .optional(),
  email: z.string().email("Email inválido").toLowerCase().optional(),
  role: z.enum(["ADMIN", "SUPER_ADMIN"]).optional(),
  isActive: z.boolean().optional(),
});

// Schema para alterar senha
export const changePasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(6, "Nova senha deve ter pelo menos 6 caracteres")
      .max(100, "Nova senha deve ter no máximo 100 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });

// Schema para filtros e busca
export const userFiltersSchema = z.object({
  page: z
    .string()
    .transform((val) => parseInt(val) || 1)
    .optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val) || 10)
    .optional(),
  search: z.string().optional(),
  role: z.enum(["ADMIN", "SUPER_ADMIN"]).optional(),
  isActive: z
    .string()
    .transform((val) => val === "true")
    .optional(),
});

// Tipos derivados dos schemas
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UserFiltersInput = z.infer<typeof userFiltersSchema>;
