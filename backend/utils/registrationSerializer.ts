import { canViewFinancialValues, canViewRegistrationNotes } from "@/lib/permissions";

/**
 * Remove campos financeiros de uma inscrição para perfis sem permissão de ver
 * valores (CHECKIN e SUPPORT) — ver ADR-002 em docs/melhorias-2.0/decisoes.md.
 * Mantém paymentMethod (SUPPORT precisa do método, nunca dos valores).
 * Observação e responsável pelo dinheiro são removidos para quem não pode
 * vê-los (CHECKIN) — ver canViewRegistrationNotes.
 */
export function sanitizeRegistrationForRole<
  T extends {
    paymentId?: string | null;
    paymentError?: string | null;
    paymentDetails?: unknown;
    event?: { price?: number } | null;
    notes?: string | null;
    cashResponsible?: string | null;
  }
>(registration: T, role: string | null | undefined): T {
  const canSeeValues = canViewFinancialValues(role);
  const canSeeNotes = canViewRegistrationNotes(role);

  if (canSeeValues && canSeeNotes) {
    return registration;
  }

  const sanitized = { ...registration };

  if (!canSeeNotes) {
    sanitized.notes = null;
    sanitized.cashResponsible = null;
  }

  if (canSeeValues) {
    return sanitized;
  }

  sanitized.paymentId = null;
  sanitized.paymentError = null;
  sanitized.paymentDetails = null;

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
    notes?: string | null;
    cashResponsible?: string | null;
  }
>(registrations: T[], role: string | null | undefined): T[] {
  if (canViewFinancialValues(role) && canViewRegistrationNotes(role)) {
    return registrations;
  }

  return registrations.map((registration) =>
    sanitizeRegistrationForRole(registration, role)
  );
}
