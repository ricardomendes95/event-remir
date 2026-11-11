import { z } from "zod";

const cpfField = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(z.string().length(11, "CPF deve ter 11 dígitos"));

/** Solicitação do participante (rota pública): CPF da inscrição + motivo. */
export const RefundRequestCreateSchema = z.object({
  cpf: cpfField,
  reason: z
    .string()
    .trim()
    .min(5, "Conte em poucas palavras o motivo do cancelamento")
    .max(500, "O motivo deve ter no máximo 500 caracteres"),
});

/** Desistência da solicitação pelo participante (rota pública). */
export const RefundRequestWithdrawSchema = z.object({
  cpf: cpfField,
});

const notes = z.string().trim().max(1000).optional();

/** Ações do admin sobre uma solicitação (PATCH). */
export const AdminRefundActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_contact"), adminNotes: notes }),
  z.object({ action: z.literal("deny"), adminNotes: notes }),
  z.object({
    action: z.literal("register_refund"),
    refundedAmount: z
      .number({ message: "Informe o valor estornado" })
      .positive("O valor estornado deve ser maior que zero"),
    refundedAt: z.string().datetime().optional(),
    confirmed: z.literal(true, {
      message: "Confirme que o estorno já foi feito no app da InfinitePay",
    }),
    adminNotes: notes,
  }),
  z.object({ action: z.literal("cancel_without_refund"), adminNotes: notes }),
  z.object({ action: z.literal("reactivate"), adminNotes: notes }),
  z.object({ action: z.literal("reopen"), adminNotes: notes }),
]);

export type AdminRefundAction = z.infer<typeof AdminRefundActionSchema>;

export const AdminRefundListQuerySchema = z.object({
  status: z.enum(["ACTIVE", "OPEN", "IN_CONTACT", "RESOLVED", "ALL"]).default("ACTIVE"),
  eventId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
