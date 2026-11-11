import type { FinancialSummary } from "@/backend/utils/revenueBreakdown";

export type { FinancialSummary };

export interface FinancialEventLine {
  eventId: string;
  eventTitle: string;
  eventDate: string | null;
  confirmedRegistrations: number;
  pendingRegistrations: number;
  pendingAmount: number;
  gross: number;
  shirtRevenue: number;
  fees: number;
  refunds: number;
  net: number;
}

export interface FinancialReport {
  scope: {
    eventId: string | null;
    eventTitle: string | null;
    eventDate: string | null;
  };
  summary: FinancialSummary;
  byEvent: FinancialEventLine[];
}

export interface FinancialPeriod {
  start: string | null;
  end: string | null;
}

export const METHOD_LABELS = {
  INFINITE_PAY: "InfinitePay (online)",
  MANUAL_PIX: "Manual - PIX",
  MANUAL_CASH: "Manual - Dinheiro",
  MANUAL_CARD: "Manual - Cartão",
  MANUAL_UNSPECIFIED: "Manual - forma não informada",
} as const;

export const CHANNEL_LABELS = {
  PIX: "Pix",
  CREDIT_1X: "Crédito à vista",
  CREDIT_INSTALLMENTS: "Crédito parcelado",
  UNKNOWN: "Forma não identificada",
} as const;

export const CRITERIA_NOTES = [
  "Valores brutos, em reais. Entram as inscrições confirmadas e as canceladas com estorno concluído; o estorno é descontado à parte.",
  "Receita de camisa = diferença entre o preço com camisa e o preço sem camisa do lote da inscrição (ou do evento, se não houver lote). Camisas avulsas entram integralmente na receita de camisas.",
  "Pedidos em grupo são somados pelas inscrições, sem contar o pedido duas vezes. Inscrições gratuitas contam como inscritos e valem R$ 0,00.",
  "Taxas são uma estimativa pela tabela de referência da InfinitePay (Pix 0%, crédito à vista 4,20%, parcelado a partir de 6,09%). O valor real depende da conta e deve ser conferido no extrato; se o repasse da taxa ao participante estiver ativo, o líquido real é maior.",
  "Valores de eventos antigos são calculados com os preços atuais do evento e do lote; se os preços mudaram depois das inscrições, o resultado é aproximado.",
] as const;

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
