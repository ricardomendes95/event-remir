import {
  MANUAL_PAYMENT_TYPE_LABELS,
  type ManualPaymentTypeValue,
} from "@/backend/schemas/registrationSchemas";

/** Texto curto do pagamento para listas impressas: "Manual · Dinheiro (com João)". */
export function formatPaymentSummary(r: {
  paymentMethod?: string | null;
  manualPaymentType?: ManualPaymentTypeValue | null;
  cashResponsible?: string | null;
}): string {
  if (r.paymentMethod === "MANUAL") {
    if (!r.manualPaymentType) return "Manual (não informado)";
    const base = `Manual · ${MANUAL_PAYMENT_TYPE_LABELS[r.manualPaymentType]}`;
    return r.manualPaymentType === "CASH" && r.cashResponsible
      ? `${base} (com ${r.cashResponsible})`
      : base;
  }
  if (r.paymentMethod === "FREE") return "Gratuito";
  if (r.paymentMethod === "INFINITE_PAY") return "InfinitePay";
  if (r.paymentMethod === "MERCADO_PAGO") return "Mercado Pago";
  return "—";
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
