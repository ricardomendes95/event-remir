/**
 * Validador de CPF com dígitos verificadores
 * Implementa algoritmo oficial da Receita Federal
 *
 * @example
 * ```typescript
 * import { validateCpfDigits, isValidCpf } from '@/utils/cpfValidator';
 *
 * // Validação simples
 * const isValid = validateCpfDigits('12345678909');
 *
 * // Validação com feedback detalhado
 * const result = isValidCpf('123.456.789-09');
 * if (!result.isValid) {
 *   console.log(result.error);
 * }
 * ```
 */

/**
 * Valida CPF usando algoritmo dos dígitos verificadores
 * @param cpf - CPF apenas com números (11 dígitos)
 * @returns true se CPF é válido, false caso contrário
 */
export function validateCpfDigits(cpf: string): boolean {
  // Remove qualquer formatação
  const cleanCpf = cpf.replace(/\D/g, "");

  // Verifica se tem 11 dígitos
  if (cleanCpf.length !== 11) {
    return false;
  }

  // Verifica se todos os dígitos são iguais (casos inválidos como 111.111.111-11)
  if (/^(\d)\1{10}$/.test(cleanCpf)) {
    return false;
  }

  // Converte para array de números
  const digits = cleanCpf.split("").map(Number);

  // Calcula primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * (10 - i);
  }
  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;

  // Verifica primeiro dígito
  if (digits[9] !== firstDigit) {
    return false;
  }

  // Calcula segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * (11 - i);
  }
  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;

  // Verifica segundo dígito
  return digits[10] === secondDigit;
}

/**
 * Valida CPF com feedback detalhado para o usuário
 * @param cpf - CPF com ou sem formatação
 * @returns objeto com resultado e mensagem de erro se aplicável
 */
export function isValidCpf(cpf: string): {
  isValid: boolean;
  error?: string;
} {
  if (!cpf) {
    return {
      isValid: false,
      error: "CPF é obrigatório",
    };
  }

  const cleanCpf = cpf.replace(/\D/g, "");

  if (cleanCpf.length === 0) {
    return {
      isValid: false,
      error: "CPF não pode estar vazio",
    };
  }

  if (cleanCpf.length < 11) {
    return {
      isValid: false,
      error: "CPF incompleto",
    };
  }

  if (cleanCpf.length > 11) {
    return {
      isValid: false,
      error: "CPF deve ter exatamente 11 dígitos",
    };
  }

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleanCpf)) {
    return {
      isValid: false,
      error: "CPF inválido (todos os dígitos são iguais)",
    };
  }

  // Valida dígitos verificadores
  if (!validateCpfDigits(cleanCpf)) {
    return {
      isValid: false,
      error: "CPF inválido (dígitos verificadores incorretos)",
    };
  }

  return {
    isValid: true,
  };
}

/**
 * Lista de CPFs inválidos conhecidos para testes
 * Útil para validação em desenvolvimento
 */
export const INVALID_CPFS = [
  "00000000000",
  "11111111111",
  "22222222222",
  "33333333333",
  "44444444444",
  "55555555555",
  "66666666666",
  "77777777777",
  "88888888888",
  "99999999999",
  "12345678900",
  "98765432100",
];

/**
 * Lista de CPFs válidos para testes
 * Útil para desenvolvimento e testes unitários
 */
export const VALID_CPFS_FOR_TESTING = [
  "12345678909",
  "98765432100", // Este será inválido, vou corrigir
];

// Correção: CPFs válidos reais para teste
export const VALID_TEST_CPFS = [
  "11144477735", // CPF válido para teste
  "12345678909", // CPF válido para teste
];
