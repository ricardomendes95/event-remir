import { isValidCpf } from "@/utils/cpfValidator";
import { validateDynamicFormData } from "@/backend/utils/dynamicFormValidator";
import { validateShirtSelection } from "@/backend/utils/shirtPricing";
import type {
  DynamicField,
  DynamicFormFields,
} from "@/backend/schemas/dynamicFormSchemas";
import type {
  FreeBatchParticipantInput,
  PaidBatchParticipantInput,
} from "@/backend/schemas/batchRegistrationSchemas";

export type RegistrationMode = "PAID" | "FREE";

/** Erro de validação de um participante do lote (índice no array enviado). */
export interface ParticipantIssue {
  index: number;
  field: string;
  message: string;
  code:
    | "INVALID_FIELD"
    | "INVALID_CPF"
    | "CPF_DUPLICATED_IN_BATCH"
    | "CPF_ALREADY_REGISTERED"
    | "CPF_PENDING_INDIVIDUAL"
    | "CPF_IN_OTHER_ORDER";
}

export interface EventForValidation {
  isActive: boolean;
  isFree: boolean;
  formMode: "FIXED_ONLY" | "DYNAMIC_ONLY" | "BOTH";
  registrationStartDate: Date;
  registrationEndDate: Date;
  allowBatchRegistration: boolean;
  dynamicFormFields: unknown;
  fixedFieldsConfig: unknown;
  shirtConfig: unknown;
}

export interface EventGateError {
  status: number;
  error: string;
}

/** Regras de nível de evento (idênticas às do fluxo individual + flag de lote). */
export function validateEventForBatch(
  event: EventForValidation,
  mode: RegistrationMode,
  now: Date = new Date()
): EventGateError | null {
  if (!event.isActive) return { status: 400, error: "Evento não está ativo" };
  if (mode === "PAID" && event.isFree) {
    return {
      status: 400,
      error:
        "Este evento é gratuito. Use /api/registrations/create-free-batch para criar as inscrições.",
    };
  }
  if (mode === "FREE" && !event.isFree) {
    return {
      status: 400,
      error: "Este evento não é gratuito. Use o fluxo de pagamento normal.",
    };
  }
  if (mode === "PAID" && event.formMode === "DYNAMIC_ONLY") {
    return {
      status: 400,
      error:
        "Configuração inválida: DYNAMIC_ONLY só é permitido em eventos gratuitos",
    };
  }
  if (!event.allowBatchRegistration) {
    return {
      status: 403,
      error: "Este evento não aceita inscrição de várias pessoas na mesma compra",
    };
  }
  if (now < event.registrationStartDate || now > event.registrationEndDate) {
    return { status: 400, error: "Período de inscrições encerrado" };
  }
  return null;
}

export interface NormalizedParticipant {
  name: string;
  email: string | null;
  /** Só dígitos. */
  cpf: string;
  /** Só dígitos. */
  phone: string | null;
  wantsShirt: boolean;
  shirtSize: string | null;
  dynamicFormData: Record<string, unknown> | null;
}

/**
 * Valida e sanitiza os campos de um participante (sem acessar o banco).
 * Os erros saem com o índice do participante, sem interromper no primeiro.
 */
export function validateParticipantFields(
  event: EventForValidation,
  participant: PaidBatchParticipantInput | FreeBatchParticipantInput,
  index: number,
  mode: RegistrationMode
): { issues: ParticipantIssue[]; normalized: NormalizedParticipant | null } {
  const issues: ParticipantIssue[] = [];
  const add = (field: string, message: string, code: ParticipantIssue["code"] = "INVALID_FIELD") =>
    issues.push({ index, field, message, code });

  const cpfCheck = isValidCpf(participant.cpf);
  if (!cpfCheck.isValid) {
    add("cpf", cpfCheck.error || "CPF inválido", "INVALID_CPF");
  }
  const cpf = participant.cpf.replace(/\D/g, "");
  const phone = participant.phone ? participant.phone.replace(/\D/g, "") : "";
  const email = participant.email || null;

  if (mode === "FREE") {
    const ffc = event.fixedFieldsConfig as {
      email?: { required: boolean };
      phone?: { required: boolean };
    } | null;
    if (ffc?.email?.required && !email) {
      add("email", "Email é obrigatório para este evento");
    }
    if (ffc?.phone?.required && !phone) {
      add("phone", "Telefone é obrigatório para este evento");
    }
    if (phone && (phone.length < 10 || phone.length > 11)) {
      add("phone", "Telefone inválido");
    }
  } else if (phone.length < 10) {
    add("phone", "Telefone inválido");
  }

  let wantsShirt = false;
  let shirtSize: string | null = null;
  if (mode === "PAID") {
    const paid = participant as PaidBatchParticipantInput;
    const shirt = validateShirtSelection(event, {
      wantsShirt: paid.wantsShirt,
      shirtSize: paid.shirtSize,
    });
    if (!shirt.ok) {
      add("shirtSize", shirt.error || "Seleção de camisa inválida");
    }
    wantsShirt = shirt.wantsShirt;
    shirtSize = shirt.shirtSize;
  }

  // Pago valida o formulário dinâmico só em BOTH; gratuito sempre que não for FIXED_ONLY.
  const needsDynamic =
    mode === "PAID" ? event.formMode === "BOTH" : event.formMode !== "FIXED_ONLY";
  let dynamicFormData: Record<string, unknown> | null = null;
  if (needsDynamic) {
    if (mode === "FREE" && !participant.dynamicFormData) {
      add("dynamicFormData", "Respostas do formulário dinâmico são obrigatórias");
    } else {
      const fields = (event.dynamicFormFields as DynamicFormFields | null) ?? [];
      const result = validateDynamicFormData(
        fields as DynamicField[],
        participant.dynamicFormData ?? {}
      );
      if (result.valid) {
        dynamicFormData = result.sanitized;
      } else {
        for (const e of result.errors) {
          add(`dynamicFormData.${e.field}`, e.message);
        }
      }
    }
  }

  if (issues.length > 0) return { issues, normalized: null };
  return {
    issues,
    normalized: {
      name: participant.name,
      email,
      cpf,
      phone: phone || null,
      wantsShirt,
      shirtSize,
      dynamicFormData,
    },
  };
}

/** Índices com CPF repetido dentro do próprio lote (todos os envolvidos). */
export function findDuplicatedCpfs(cpfs: string[]): ParticipantIssue[] {
  const positions = new Map<string, number[]>();
  cpfs.forEach((cpf, i) => {
    if (!cpf) return;
    positions.set(cpf, [...(positions.get(cpf) ?? []), i]);
  });
  const issues: ParticipantIssue[] = [];
  for (const indexes of positions.values()) {
    if (indexes.length < 2) continue;
    for (const index of indexes) {
      issues.push({
        index,
        field: "cpf",
        message: `CPF repetido na mesma compra (participantes ${indexes
          .map((i) => i + 1)
          .join(" e ")})`,
        code: "CPF_DUPLICATED_IN_BATCH",
      });
    }
  }
  return issues;
}
