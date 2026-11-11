import { z } from "zod";

/** Compra posterior da camisa: a inscrição é identificada por id + CPF. */
export const CreateShirtPreferenceSchema = z.object({
  registrationId: z.string().min(1, "Inscrição é obrigatória"),
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 11, "CPF deve ter 11 dígitos"),
  shirtSize: z
    .string({ error: "Escolha o tamanho da camisa" })
    .trim().min(1, "Escolha o tamanho da camisa").max(20),
});

export type CreateShirtPreferenceInput = z.infer<
  typeof CreateShirtPreferenceSchema
>;
