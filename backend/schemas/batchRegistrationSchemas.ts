import { z } from "zod";

/** Máximo de participantes por compra em lote (validado também no servidor). */
export const MAX_BATCH_SIZE = 10;

const dynamicFormDataSchema = z.record(z.string(), z.unknown()).optional();

/** Participante de um lote pago: mesmos campos obrigatórios do fluxo individual. */
export const PaidBatchParticipantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome muito longo"),
  email: z.string().email("Email inválido"),
  cpf: z.string().min(11, "CPF deve ter 11 dígitos"),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  dynamicFormData: dynamicFormDataSchema,
  wantsShirt: z.boolean().optional(),
  shirtSize: z.string().nullable().optional(),
});

/** Participante de um lote gratuito: email/telefone seguem `fixedFieldsConfig`. */
export const FreeBatchParticipantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome muito longo"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  cpf: z.string().min(11, "CPF deve ter 11 dígitos"),
  phone: z.string().optional().or(z.literal("")),
  dynamicFormData: dynamicFormDataSchema,
});

const participantsArray = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(item)
    .min(1, "Informe ao menos um participante")
    .max(
      MAX_BATCH_SIZE,
      `O máximo é de ${MAX_BATCH_SIZE} participantes por compra`
    );

export const CreateBatchPreferenceSchema = z.object({
  eventId: z.string().min(1, "ID do evento é obrigatório"),
  participants: participantsArray(PaidBatchParticipantSchema),
});

export const CreateFreeBatchSchema = z.object({
  eventId: z.string().min(1, "ID do evento é obrigatório"),
  participants: participantsArray(FreeBatchParticipantSchema),
});

export const UpdateBatchPreferenceSchema = z.object({
  orderId: z.string().min(1, "ID do pedido é obrigatório"),
});

export const LeaveOrderSchema = z.object({
  cpf: z.string().min(11, "CPF deve ter 11 dígitos"),
});

export type PaidBatchParticipantInput = z.infer<
  typeof PaidBatchParticipantSchema
>;
export type FreeBatchParticipantInput = z.infer<
  typeof FreeBatchParticipantSchema
>;
