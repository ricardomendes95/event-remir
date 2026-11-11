import type { ManualPaymentTypeValue } from "@/backend/schemas/registrationSchemas";

export type RegistrationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "PAYMENT_FAILED";

export interface AdminRefundRequest {
  id: string;
  origin: "PARTICIPANT" | "ADMIN";
  status: "OPEN" | "IN_CONTACT" | "RESOLVED";
  resolution:
    | "REFUNDED"
    | "DENIED"
    | "WITHDRAWN"
    | "CANCELLED_NO_REFUND"
    | null;
  createdAt: string;
  resolvedAt: string | null;
}

/** Inscrição como devolvida por GET /api/registrations (já sanitizada por perfil). */
export interface AdminRegistration {
  id: string;
  name: string;
  email: string | null;
  cpf: string;
  phone: string | null;
  status: RegistrationStatus;
  paymentId?: string | null;
  paymentMethod?: string;
  manualPaymentType?: ManualPaymentTypeValue | null;
  cashResponsible?: string | null;
  notes?: string | null;
  /** Derivada de paymentDetails no servidor; visível a todos os perfis. */
  paymentDate?: string | null;
  checkedInAt?: string | null;
  wantsShirt?: boolean;
  shirtSize?: string | null;
  createdAt: string;
  updatedAt: string;
  dynamicFormData?: Record<string, unknown> | null;
  batch?: { id: string; name: string } | null;
  order?: {
    id: string;
    status: string;
    registrations: { id: string; name: string }[];
    _count: { registrations: number };
  } | null;
  /** Só para quem vê valores (ADMIN/SUPER_ADMIN). */
  refundRequests?: AdminRefundRequest[];
  event: {
    id: string;
    title: string;
    price?: number;
    startDate: string;
  };
}

/** Solicitação de estorno ainda em aberto (aguardando a organização). */
export function hasOpenRefund(registration: AdminRegistration): boolean {
  return !!registration.refundRequests?.some((r) => r.status !== "RESOLVED");
}
