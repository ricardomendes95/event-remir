import { validateCpfDigits } from "@/utils/cpfValidator";
import type { DynamicField } from "@/backend/schemas/dynamicFormSchemas";

export type DynamicFormValidationResult =
  | { valid: true; sanitized: Record<string, unknown> }
  | { valid: false; errors: { field: string; message: string }[] };

const isEmpty = (v: unknown): boolean =>
  v === undefined ||
  v === null ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0);

export function validateDynamicFormData(
  fields: DynamicField[],
  data: Record<string, unknown>
): DynamicFormValidationResult {
  const errors: { field: string; message: string }[] = [];
  const sanitized: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = data?.[field.id];

    if (isEmpty(raw)) {
      if (field.required) {
        errors.push({
          field: field.id,
          message: `${field.label} é obrigatório`,
        });
      }
      continue;
    }

    switch (field.type) {
      case "text":
      case "textarea": {
        if (typeof raw !== "string") {
          errors.push({ field: field.id, message: `${field.label} inválido` });
          break;
        }
        const trimmed = raw.trim();
        if (
          field.minLength !== undefined &&
          trimmed.length < field.minLength
        ) {
          errors.push({
            field: field.id,
            message: `${field.label} deve ter pelo menos ${field.minLength} caracteres`,
          });
          break;
        }
        if (
          field.maxLength !== undefined &&
          trimmed.length > field.maxLength
        ) {
          errors.push({
            field: field.id,
            message: `${field.label} deve ter no máximo ${field.maxLength} caracteres`,
          });
          break;
        }
        sanitized[field.id] = trimmed;
        break;
      }

      case "number": {
        const n = typeof raw === "string" ? Number(raw) : raw;
        if (typeof n !== "number" || !Number.isFinite(n)) {
          errors.push({
            field: field.id,
            message: `${field.label} deve ser um número`,
          });
          break;
        }
        if (field.integer && !Number.isInteger(n)) {
          errors.push({
            field: field.id,
            message: `${field.label} deve ser um número inteiro`,
          });
          break;
        }
        if (field.min !== undefined && n < field.min) {
          errors.push({
            field: field.id,
            message: `${field.label} deve ser ≥ ${field.min}`,
          });
          break;
        }
        if (field.max !== undefined && n > field.max) {
          errors.push({
            field: field.id,
            message: `${field.label} deve ser ≤ ${field.max}`,
          });
          break;
        }
        sanitized[field.id] = n;
        break;
      }

      case "phone": {
        if (typeof raw !== "string") {
          errors.push({ field: field.id, message: `${field.label} inválido` });
          break;
        }
        const digits = raw.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 11) {
          errors.push({
            field: field.id,
            message: `${field.label} deve ter 10 ou 11 dígitos`,
          });
          break;
        }
        sanitized[field.id] = digits;
        break;
      }

      case "cpf": {
        if (typeof raw !== "string") {
          errors.push({ field: field.id, message: `${field.label} inválido` });
          break;
        }
        const digits = raw.replace(/\D/g, "");
        if (!validateCpfDigits(digits)) {
          errors.push({
            field: field.id,
            message: `${field.label} inválido`,
          });
          break;
        }
        sanitized[field.id] = digits;
        break;
      }

      case "select":
      case "radio": {
        if (typeof raw !== "string") {
          errors.push({
            field: field.id,
            message: `${field.label} inválido`,
          });
          break;
        }
        if (!field.options.some((o) => o.value === raw)) {
          errors.push({
            field: field.id,
            message: `${field.label}: opção inválida`,
          });
          break;
        }
        sanitized[field.id] = raw;
        break;
      }

      case "checkbox": {
        if (field.multi) {
          if (!Array.isArray(raw)) {
            errors.push({
              field: field.id,
              message: `${field.label} deve ser uma lista`,
            });
            break;
          }
          const validValues = new Set(field.options.map((o) => o.value));
          const invalid = raw.filter(
            (v) => typeof v !== "string" || !validValues.has(v)
          );
          if (invalid.length > 0) {
            errors.push({
              field: field.id,
              message: `${field.label}: opção(ões) inválida(s)`,
            });
            break;
          }
          sanitized[field.id] = raw as string[];
        } else {
          if (typeof raw !== "boolean") {
            errors.push({
              field: field.id,
              message: `${field.label} deve ser true ou false`,
            });
            break;
          }
          sanitized[field.id] = raw;
        }
        break;
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, sanitized };
}
