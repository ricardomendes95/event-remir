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

export const MANUAL_PAYMENT_TYPES = ["PIX", "CASH", "CARD"] as const;
export type ManualPaymentTypeValue = (typeof MANUAL_PAYMENT_TYPES)[number];

export const MANUAL_PAYMENT_TYPE_LABELS: Record<ManualPaymentTypeValue, string> =
  {
    PIX: "PIX",
    CASH: "Dinheiro",
    CARD: "Cartão",
  };

export const REGISTRATION_NOTES_MAX_LENGTH = 500;

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const optionalText = (max: number, message: string) =>
  z.preprocess(emptyToNull, z.string().trim().max(max, message).nullish());

const manualPaymentFields = {
  manualPaymentType: z.preprocess(
    emptyToNull,
    z
      .enum(MANUAL_PAYMENT_TYPES, {
        message: "Método de pagamento manual inválido",
      })
      .nullish()
  ),
  cashResponsible: optionalText(100, "Nome do responsável muito longo"),
  notes: optionalText(
    REGISTRATION_NOTES_MAX_LENGTH,
    `Observação deve ter no máximo ${REGISTRATION_NOTES_MAX_LENGTH} caracteres`
  ),
};

/**
 * Regras entre origem do pagamento e detalhes do pagamento manual:
 * - MANUAL exige `manualPaymentType`; qualquer outra origem o proíbe;
 * - `cashResponsible` só existe quando o método manual é Dinheiro.
 */
export function manualPaymentIssues(data: {
  paymentMethod?: string | null;
  manualPaymentType?: string | null;
  cashResponsible?: string | null;
}): Array<{ field: string; message: string }> {
  const issues: Array<{ field: string; message: string }> = [];

  if (data.paymentMethod === "MANUAL") {
    if (!data.manualPaymentType) {
      issues.push({
        field: "manualPaymentType",
        message: "Informe como o pagamento manual foi feito (PIX, Dinheiro ou Cartão)",
      });
    }
  } else if (data.manualPaymentType) {
    issues.push({
      field: "manualPaymentType",
      message: "Método de pagamento manual só vale para inscrições manuais",
    });
  }

  if (data.cashResponsible && data.manualPaymentType !== "CASH") {
    issues.push({
      field: "cashResponsible",
      message: "Responsável pelo dinheiro só vale para pagamento em dinheiro",
    });
  }

  return issues;
}

const baseRegistrationFields = {
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome muito longo"),
  email: z.preprocess(
    emptyToNull,
    z.string().email("Email inválido").nullish()
  ),
  cpf: z
    .string()
    .refine((cpf) => cpf.replace(/\D/g, "").length === 11, "CPF deve ter 11 dígitos"),
  phone: z.preprocess(
    emptyToNull,
    z
      .string()
      .refine((phone) => {
        const digits = phone.replace(/\D/g, "");
        return digits.length >= 10 && digits.length <= 11;
      }, "Telefone deve ter entre 10 e 11 dígitos")
      .nullish()
  ),
  eventId: z.string().min(1, "Evento é obrigatório"),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "PAYMENT_FAILED"]),
  dynamicFormData: z.record(z.string(), z.unknown()).nullish(),
  wantsShirt: z.boolean().optional(),
  shirtSize: z.string().nullish(),
  ...manualPaymentFields,
};

type SuperRefineCtx = z.RefinementCtx;

function addManualPaymentIssues(
  data: Parameters<typeof manualPaymentIssues>[0],
  ctx: SuperRefineCtx
) {
  for (const issue of manualPaymentIssues(data)) {
    ctx.addIssue({ code: "custom", path: [issue.field], message: issue.message });
  }
}

/** Criação de inscrição pelo admin (POST /api/registrations). */
export const AdminRegistrationCreateSchema = z
  .object({
    ...baseRegistrationFields,
    status: baseRegistrationFields.status.default("CONFIRMED"),
    paymentMethod: z
      .enum(["INFINITE_PAY", "MANUAL"], {
        message: "Método de pagamento inválido",
      })
      .default("MANUAL"),
  })
  .superRefine(addManualPaymentIssues);

/**
 * Edição de inscrição pelo admin (PUT /api/registrations/[id]). Todos os
 * campos são opcionais; MERCADO_PAGO é aceito só para manter históricos.
 * A combinação final com o registro salvo é validada na rota.
 */
export const AdminRegistrationUpdateSchema = z
  .object({
    ...baseRegistrationFields,
    paymentMethod: z.enum(["INFINITE_PAY", "MERCADO_PAGO", "MANUAL", "FREE"], {
      message: "Método de pagamento inválido",
    }),
  })
  .partial()
  .superRefine((data, ctx) => {
    if (data.paymentMethod && data.paymentMethod !== "MANUAL") {
      addManualPaymentIssues(
        { ...data, paymentMethod: data.paymentMethod },
        ctx
      );
    } else if (data.cashResponsible && data.manualPaymentType && data.manualPaymentType !== "CASH") {
      addManualPaymentIssues(data, ctx);
    }
  });

export type RegistrationData = z.infer<typeof RegistrationCreateSchema>;
export type RegistrationSearchData = z.infer<typeof RegistrationSearchSchema>;
export type RegistrationUpdateData = z.infer<typeof RegistrationUpdateSchema>;
export type AdminRegistrationCreateData = z.infer<
  typeof AdminRegistrationCreateSchema
>;
export type AdminRegistrationUpdateData = z.infer<
  typeof AdminRegistrationUpdateSchema
>;
