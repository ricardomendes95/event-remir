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
