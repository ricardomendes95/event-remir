import { z } from "zod";

export const DynamicFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "phone",
  "cpf",
  "select",
  "checkbox",
  "radio",
]);

export type DynamicFieldType = z.infer<typeof DynamicFieldTypeSchema>;

const FieldOptionSchema = z.object({
  value: z.string().min(1, "Valor obrigatório").max(100),
  label: z.string().min(1, "Rótulo obrigatório").max(200),
});

const optionsArray = z
  .array(FieldOptionSchema)
  .min(1, "Pelo menos uma opção é obrigatória")
  .max(50, "Máximo de 50 opções")
  .refine(
    (opts) => new Set(opts.map((o) => o.value)).size === opts.length,
    "Valores das opções devem ser únicos"
  );

const FieldBase = {
  id: z
    .string()
    .min(1, "ID obrigatório")
    .max(40, "ID muito longo")
    .regex(/^[a-z0-9_]+$/, "ID deve conter apenas a-z, 0-9 ou _"),
  label: z
    .string()
    .min(1, "Rótulo obrigatório")
    .max(120, "Rótulo muito longo"),
  required: z.boolean(),
  helpText: z.string().max(300).optional(),
};

export const DynamicFieldSchema = z.discriminatedUnion("type", [
  z.object({
    ...FieldBase,
    type: z.literal("text"),
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(1).max(1000).optional(),
    placeholder: z.string().max(120).optional(),
  }),
  z.object({
    ...FieldBase,
    type: z.literal("textarea"),
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(1).max(5000).optional(),
    placeholder: z.string().max(120).optional(),
  }),
  z.object({
    ...FieldBase,
    type: z.literal("number"),
    min: z.number().optional(),
    max: z.number().optional(),
    integer: z.boolean().optional(),
  }),
  z.object({
    ...FieldBase,
    type: z.literal("phone"),
  }),
  z.object({
    ...FieldBase,
    type: z.literal("cpf"),
  }),
  z.object({
    ...FieldBase,
    type: z.literal("select"),
    options: optionsArray,
  }),
  z.object({
    ...FieldBase,
    type: z.literal("radio"),
    options: optionsArray,
  }),
  z.object({
    ...FieldBase,
    type: z.literal("checkbox"),
    options: optionsArray,
    multi: z.boolean(),
  }),
]);

export const DynamicFormFieldsSchema = z
  .array(DynamicFieldSchema)
  .max(30, "Máximo de 30 campos")
  .refine(
    (fields) => new Set(fields.map((f) => f.id)).size === fields.length,
    "IDs dos campos devem ser únicos"
  );

export const DynamicFormDataSchema = z.record(z.string(), z.unknown());

export type DynamicField = z.infer<typeof DynamicFieldSchema>;
export type DynamicFormFields = z.infer<typeof DynamicFormFieldsSchema>;
export type DynamicFormData = z.infer<typeof DynamicFormDataSchema>;
export type DynamicFieldOption = z.infer<typeof FieldOptionSchema>;
