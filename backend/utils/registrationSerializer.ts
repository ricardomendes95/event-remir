import { canViewFinancialValues } from "@/lib/permissions";

/**
 * Remove campos financeiros de uma inscrição para perfis sem permissão de ver
 * valores (CHECKIN e SUPPORT) — ver ADR-002 em docs/melhorias-2.0/decisoes.md.
 * Mantém paymentMethod (SUPPORT precisa do método, nunca dos valores).
 */
export function sanitizeRegistrationForRole<
  T extends {
    paymentId?: string | null;
    paymentError?: string | null;
    paymentDetails?: unknown;
    event?: { price?: number } | null;
  }
>(registration: T, role: string | null | undefined): T {
  if (canViewFinancialValues(role)) {
    return registration;
  }

  const sanitized = {
    ...registration,
    paymentId: null,
    paymentError: null,
    paymentDetails: null,
  };

  if (sanitized.event && "price" in sanitized.event) {
    sanitized.event = { ...sanitized.event, price: undefined };
    delete (sanitized.event as { price?: number }).price;
  }

  return sanitized;
}

export function sanitizeRegistrationsForRole<
  T extends {
    paymentId?: string | null;
    paymentError?: string | null;
    paymentDetails?: unknown;
    event?: { price?: number } | null;
  }
>(registrations: T[], role: string | null | undefined): T[] {
  if (canViewFinancialValues(role)) {
    return registrations;
  }

  return registrations.map((registration) =>
    sanitizeRegistrationForRole(registration, role)
  );
}
