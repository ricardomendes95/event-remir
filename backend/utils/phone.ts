/** Extrai DDD (area_code) e número de um telefone brasileiro de forma robusta. */
export function parsePhoneNumber(phone: string) {
  const cleanPhone = phone.replace(/\D/g, "");

  // 11 dígitos (9 + DDD) ou 10 dígitos (8 + DDD): extrair normalmente
  if (cleanPhone.length === 11 || cleanPhone.length === 10) {
    return {
      area_code: cleanPhone.substring(0, 2),
      number: cleanPhone.substring(2),
    };
  }

  // Fallback: assumir que os 2 primeiros são DDD
  return {
    area_code: cleanPhone.substring(0, 2) || "11",
    number: cleanPhone.substring(2) || cleanPhone,
  };
}

/**
 * Normaliza um telefone brasileiro para o formato E.164 (`+55DDDNÚMERO`).
 *
 * Necessário para gateways como o InfinitePay, que sem o código de país tentam
 * inferi-lo a partir dos dígitos crus — e leem o DDD (ex.: `81`) como código de
 * outro país (+81 Japão), gerando um telefone inválido e impedindo o envio do
 * código por WhatsApp. Sempre força o `+55` do Brasil.
 *
 * Retorna `undefined` quando não há dígitos suficientes para um número válido.
 */
export function toBrazilE164(phone?: string | null): string | undefined {
  if (!phone) return undefined;

  let digits = phone.replace(/\D/g, "");
  if (!digits) return undefined;

  // Remove prefixo de discagem internacional (ex.: "0055..." ou "00...").
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Já vem com o código do país (55 + 10/11 dígitos): usa como está.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }

  // DDD + número (10 ou 11 dígitos): prefixa o +55 do Brasil.
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }

  // Formato inesperado: ainda assim força o +55 para não deixar o gateway
  // adivinhar o país a partir dos primeiros dígitos.
  return `+55${digits}`;
}
