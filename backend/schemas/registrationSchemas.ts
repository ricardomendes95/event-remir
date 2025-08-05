import { z } from "zod";

// CPF validation regex
const cpfRegex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;

export const RegistrationCreateSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome muito longo"),
  email: z.string().email("Email inválido"),
  cpf: z.string().regex(cpfRegex, "CPF inválido").optional(),
  eventId: z.string().cuid("ID do evento inválido"),
});

export const RegistrationSearchSchema = z
  .object({
    cpf: z.string().regex(cpfRegex, "CPF inválido").optional(),
    email: z.string().email("Email inválido").optional(),
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").optional(),
  })
  .refine((data) => data.cpf || data.email || data.name, {
    message: "Informe pelo menos um campo para busca",
  });

export const RegistrationUpdateSchema = z.object({
  paymentStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  transactionId: z.string().optional(),
  checkin: z.boolean().optional(),
  checkinAt: z.string().datetime().optional(),
});

export const ManualRegistrationSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome muito longo"),
  email: z.string().email("Email inválido"),
  cpf: z.string().regex(cpfRegex, "CPF inválido").optional(),
  eventId: z.string().cuid("ID do evento inválido"),
  paymentType: z.enum(["pix", "credit_card", "manual"]),
  amountPaid: z.number().min(0, "Valor deve ser maior ou igual a zero"),
  transactionId: z.string().optional(),
});

export type RegistrationData = z.infer<typeof RegistrationCreateSchema>;
export type RegistrationSearchData = z.infer<typeof RegistrationSearchSchema>;
export type RegistrationUpdateData = z.infer<typeof RegistrationUpdateSchema>;
export type ManualRegistrationData = z.infer<typeof ManualRegistrationSchema>;
