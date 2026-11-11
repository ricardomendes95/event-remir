/**
 * Data do pagamento derivada de `Registration.paymentDetails` (JSON).
 *
 * Fica fora de `paymentDetails` para que perfis sem acesso a valores
 * (CHECKIN/SUPPORT) também vejam a data — data não é valor financeiro
 * (ADR-002, RFC req. 9). Tolerante a formatos legados: sem data reconhecível
 * devolve null, nunca lança.
 */
const DATE_KEYS = [
  "dateProcessed", // webhook InfinitePay / pedido em grupo
  "paidAt",
  "paid_at",
  "date_approved", // legado Mercado Pago
  "dateApproved",
  "date_created",
] as const;

export function resolvePaymentDate(paymentDetails: unknown): string | null {
  if (!paymentDetails || typeof paymentDetails !== "object") return null;
  const details = paymentDetails as Record<string, unknown>;

  for (const key of DATE_KEYS) {
    const value = details[key];
    if (typeof value !== "string" && typeof value !== "number") continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

/** Acrescenta `paymentDate` a uma inscrição (chamar antes de sanitizar por perfil). */
export function withPaymentDate<T extends { paymentDetails?: unknown }>(
  registration: T
): T & { paymentDate: string | null } {
  return {
    ...registration,
    paymentDate: resolvePaymentDate(registration.paymentDetails),
  };
}
