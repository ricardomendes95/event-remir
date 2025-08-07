import { useState, useCallback } from "react";
import { z } from "zod";
import dayjs, { Dayjs } from "dayjs";

// Schema igual ao do backend
export const EventCreateSchema = z
  .object({
    title: z
      .string()
      .min(3, "Título deve ter pelo menos 3 caracteres")
      .max(100, "Título muito longo"),
    description: z
      .string()
      .min(10, "Descrição deve ter pelo menos 10 caracteres")
      .max(1000, "Descrição muito longa"),
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
    bannerUrl: z.string().url("URL inválida").optional().or(z.literal("")),
    isActive: z.boolean().default(true),
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

// Tipo para os dados do formulário (com Dayjs para datas)
interface EventFormData {
  title: string;
  description: string;
  slug: string;
  startDate: Dayjs;
  endDate: Dayjs;
  registrationStartDate: Dayjs;
  registrationEndDate: Dayjs;
  location: string;
  maxParticipants: string | number;
  price: string | number;
  bannerUrl?: string;
  isActive: boolean;
}

interface FieldError {
  field: string;
  message: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  fieldErrors: FieldError[];
}

export function useEventValidation() {
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  // Validar dados do formulário
  const validateFormData = useCallback(
    (values: EventFormData): ValidationResult => {
      try {
        // Converter dados do formulário para o formato esperado pelo schema
        const dataToValidate = {
          ...values,
          startDate: dayjs(values.startDate).toISOString(),
          endDate: dayjs(values.endDate).toISOString(),
          registrationStartDate: dayjs(
            values.registrationStartDate
          ).toISOString(),
          registrationEndDate: dayjs(values.registrationEndDate).toISOString(),
          maxParticipants: parseInt(values.maxParticipants.toString()),
          price: parseFloat(values.price.toString()),
          bannerUrl: values.bannerUrl || undefined,
        };

        // Validar com o schema
        EventCreateSchema.parse(dataToValidate);

        // Se chegou até aqui, não há erros
        setValidationErrors({});
        return {
          isValid: true,
          errors: {},
          fieldErrors: [],
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errors: Record<string, string> = {};
          const fieldErrors: FieldError[] = [];

          error.issues.forEach((issue) => {
            const field = issue.path.join(".");
            errors[field] = issue.message;
            fieldErrors.push({ field, message: issue.message });
          });

          setValidationErrors(errors);
          return {
            isValid: false,
            errors,
            fieldErrors,
          };
        }

        // Erro não relacionado à validação
        return {
          isValid: false,
          errors: { general: "Erro de validação desconhecido" },
          fieldErrors: [
            { field: "general", message: "Erro de validação desconhecido" },
          ],
        };
      }
    },
    []
  );

  // Processar erros da API (formato do backend)
  const setApiErrors = useCallback((apiErrors: FieldError[]) => {
    const errors: Record<string, string> = {};

    apiErrors.forEach(({ field, message }) => {
      errors[field] = message;
    });

    setValidationErrors(errors);
  }, []);

  // Limpar erros
  const clearErrors = useCallback(() => {
    setValidationErrors({});
  }, []);

  // Obter erro para um campo específico
  const getFieldError = useCallback(
    (fieldName: string) => {
      return validationErrors[fieldName];
    },
    [validationErrors]
  );

  return {
    validationErrors,
    validateFormData,
    setApiErrors,
    clearErrors,
    getFieldError,
  };
}

export type { EventFormData, FieldError, ValidationResult };
