import { z } from "zod";

// Schema para configuração de métodos de pagamento
export const PaymentMethodConfigSchema = z.object({
  enabled: z.boolean(),
  passthrough_fee: z.boolean(),
  custom_fee: z.number().min(0).max(1).optional(), // Percentual (0-1)
});

export const CreditCardConfigSchema = PaymentMethodConfigSchema.extend({
  max_installments: z.number().min(1).max(12),
  custom_fees: z.record(z.string(), z.number().min(0).max(1)).optional(), // { "1": 0.05, "2": 0.055 }
});

export const PaymentConfigSchema = z.object({
  methods: z.object({
    pix: PaymentMethodConfigSchema,
    credit_card: CreditCardConfigSchema,
    debit_card: PaymentMethodConfigSchema,
  }),
  default_method: z.enum(["pix", "credit_card", "debit_card"]).optional(),
});

export const EventCreateSchema = z
  .object({
    title: z
      .string()
      .min(3, "Título deve ter pelo menos 3 caracteres")
      .max(100, "Título muito longo"),
    description: z
      .string()
      .min(10, "Descrição deve ter pelo menos 10 caracteres")
      .max(2000, "Descrição muito longa"),
    slug: z
      .string()
      .min(3, "Slug deve ter pelo menos 3 caracteres")
      .max(100, "Slug muito longo")
      .regex(
        /^[a-z0-9-]+$/,
        "Slug deve conter apenas letras minúsculas, números e hífens"
      ),
    location: z
      .string()
      .min(5, "Local deve ter pelo menos 5 caracteres")
      .max(200, "Local muito longo"),
    startDate: z.string().datetime("Data de início inválida"),
    endDate: z.string().datetime("Data de fim inválida"),
    registrationStartDate: z
      .string()
      .datetime("Data de início das inscrições inválida"),
    registrationEndDate: z
      .string()
      .datetime("Data de fim das inscrições inválida"),
    maxParticipants: z
      .number()
      .min(1, "Deve permitir pelo menos 1 participante"),
    price: z.number().min(0, "Preço deve ser maior ou igual a zero"),
    bannerUrl: z.string().url("URL inválida").optional(),
    isActive: z.boolean().default(true),
    paymentConfig: PaymentConfigSchema.optional(),
  })
  .refine((data) => new Date(data.startDate) < new Date(data.endDate), {
    message: "Data de início deve ser anterior à data de fim",
    path: ["endDate"],
  })
  .refine(
    (data) =>
      new Date(data.registrationStartDate) < new Date(data.registrationEndDate),
    {
      message: "Data de início das inscrições deve ser anterior à data de fim",
      path: ["registrationEndDate"],
    }
  )
  .refine(
    (data) => new Date(data.registrationEndDate) <= new Date(data.startDate),
    {
      message: "Inscrições devem encerrar antes ou no início do evento",
      path: ["registrationEndDate"],
    }
  );

export const EventUpdateSchema = EventCreateSchema.partial();

export const EventSearchSchema = z.object({
  id: z.string().cuid("ID inválido").optional(),
  active: z.boolean().optional(),
  upcoming: z.boolean().optional(),
});

// Schema para atualização de preferência de pagamento
export const updatePreferenceSchema = z.object({
  registrationId: z.string().min(1, "ID da inscrição é obrigatório"),
  paymentData: z.object({
    method: z.enum(["pix", "credit_card", "debit_card"], {
      message: "Método de pagamento inválido",
    }),
    installments: z
      .number()
      .int("Número de parcelas deve ser um inteiro")
      .min(1, "Mínimo 1 parcela")
      .max(12, "Máximo 12 parcelas")
      .optional(),
  }),
});

export type EventData = z.infer<typeof EventCreateSchema>;
export type EventUpdateData = z.infer<typeof EventUpdateSchema>;
export type EventSearchData = z.infer<typeof EventSearchSchema>;
export type PaymentConfig = z.infer<typeof PaymentConfigSchema>;
export type PaymentMethodConfig = z.infer<typeof PaymentMethodConfigSchema>;
export type CreditCardConfig = z.infer<typeof CreditCardConfigSchema>;
export type UpdatePreferenceData = z.infer<typeof updatePreferenceSchema>;
