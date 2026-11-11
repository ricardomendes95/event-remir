import { z } from "zod";
import { DynamicFormFieldsSchema } from "./dynamicFormSchemas";

const FixedFieldsConfigSchema = z
  .object({
    email: z.object({ required: z.boolean().default(false) }).optional(),
    phone: z.object({ required: z.boolean().default(false) }).optional(),
  })
  .optional();

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

// Configuração do item opcional "camisa" do evento.
// priceWithoutShirt = price base do evento; priceWithShirt é o valor total da
// inscrição quando o participante escolhe levar a camisa. `sizes` é a lista de
// tamanhos definida pelo admin (ex.: ["P", "M", "G", "GG"]).
export const ShirtConfigSchema = z.object({
  enabled: z.boolean(),
  priceWithShirt: z.number().min(0, "Valor com camisa inválido"),
  sizes: z
    .array(z.string().min(1, "Tamanho inválido").max(20))
    .max(20, "Máximo de 20 tamanhos")
    .refine(
      (sizes) => new Set(sizes).size === sizes.length,
      "Tamanhos devem ser únicos"
    ),
});

// Lote de inscrição: período, vagas (opcional), prioridade e preço próprio.
// `priceWithShirt` só vale (e é obrigatório) quando o evento tem camisa.
export const EventBatchSchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z
      .string()
      .trim()
      .min(1, "Informe o nome do lote")
      .max(60, "Nome do lote muito longo"),
    startDate: z.string().datetime("Início do lote inválido"),
    endDate: z.string().datetime("Fim do lote inválido"),
    quota: z
      .number()
      .int("Vagas do lote deve ser um número inteiro")
      .min(1, "Vagas do lote deve ser pelo menos 1")
      .nullable()
      .optional(),
    priority: z.number().int().min(0).max(999).default(0),
    price: z.number().min(0, "Preço do lote inválido"),
    priceWithShirt: z.number().min(0, "Valor com camisa inválido").nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .refine((b) => new Date(b.startDate) < new Date(b.endDate), {
    message: "O início do lote deve ser anterior ao fim",
    path: ["endDate"],
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
    isFree: z.boolean().default(false),
    formMode: z
      .enum(["FIXED_ONLY", "DYNAMIC_ONLY", "BOTH"])
      .default("FIXED_ONLY"),
    dynamicFormFields: DynamicFormFieldsSchema.optional(),
    fixedFieldsConfig: FixedFieldsConfigSchema,
    paymentConfig: PaymentConfigSchema.optional(),
    shirtConfig: ShirtConfigSchema.optional(),
    batches: z.array(EventBatchSchema).max(20, "Máximo de 20 lotes").optional(),
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
  )
  .refine((data) => !data.isFree || data.price === 0, {
    message: "Eventos gratuitos devem ter preço igual a zero",
    path: ["price"],
  })
  .refine(
    (data) =>
      data.formMode === "FIXED_ONLY" ||
      (Array.isArray(data.dynamicFormFields) &&
        data.dynamicFormFields.length > 0),
    {
      message:
        "É necessário definir ao menos um campo dinâmico para este modo de formulário",
      path: ["dynamicFormFields"],
    }
  )
  .refine((data) => data.formMode !== "DYNAMIC_ONLY" || data.isFree, {
    message:
      "Formulário totalmente dinâmico só é permitido em eventos gratuitos",
    path: ["formMode"],
  })
  // Camisa só é permitida em evento pago
  .refine((data) => !data.shirtConfig?.enabled || !data.isFree, {
    message: "A opção de camisa só é permitida em eventos pagos",
    path: ["shirtConfig"],
  })
  // Com camisa habilitada, o valor com camisa deve ser maior que o valor base
  .refine(
    (data) =>
      !data.shirtConfig?.enabled || data.shirtConfig.priceWithShirt > data.price,
    {
      message: "O valor com camisa deve ser maior que o valor da inscrição",
      path: ["shirtConfig", "priceWithShirt"],
    }
  )
  // Com camisa habilitada, é preciso ao menos um tamanho
  .refine(
    (data) => !data.shirtConfig?.enabled || data.shirtConfig.sizes.length >= 1,
    {
      message: "Informe ao menos um tamanho de camisa",
      path: ["shirtConfig", "sizes"],
    }
  )
  // Lotes só existem em evento pago
  .refine((data) => !data.isFree || !data.batches?.length, {
    message: "Lotes só são permitidos em eventos pagos",
    path: ["batches"],
  })
  // Com camisa habilitada, cada lote precisa de valor com camisa maior que o do lote
  .refine(
    (data) =>
      !data.shirtConfig?.enabled ||
      (data.batches ?? []).every(
        (b) => b.priceWithShirt != null && b.priceWithShirt > b.price
      ),
    {
      message:
        "Em cada lote, o valor com camisa deve ser informado e maior que o valor do lote",
      path: ["batches"],
    }
  );

export const EventUpdateSchema = EventCreateSchema.partial();

export const EventSearchSchema = z.object({
  id: z.string().cuid("ID inválido").optional(),
  active: z.boolean().optional(),
  upcoming: z.boolean().optional(),
});

export type EventData = z.infer<typeof EventCreateSchema>;
export type EventUpdateData = z.infer<typeof EventUpdateSchema>;
export type EventSearchData = z.infer<typeof EventSearchSchema>;
export type PaymentConfig = z.infer<typeof PaymentConfigSchema>;
export type EventBatchInput = z.infer<typeof EventBatchSchema>;
export type ShirtConfig = z.infer<typeof ShirtConfigSchema>;
export type PaymentMethodConfig = z.infer<typeof PaymentMethodConfigSchema>;
export type CreditCardConfig = z.infer<typeof CreditCardConfigSchema>;