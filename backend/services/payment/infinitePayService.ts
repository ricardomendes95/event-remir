import {
  createInfinitePayCheckout,
  infinitePayConfig,
} from "@/lib/infinitepay";

/** Base URL pública da aplicação (mesma usada pelo Mercado Pago). */
function getAppBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

export interface InfinitePayCheckoutParams {
  /** Usado como order_nsu — chave de conciliação no webhook. */
  registrationId: string;
  eventTitle: string;
  /** Valor base já calculado no servidor (em reais). Inclui camisa quando aplicável. */
  baseValue: number;
  participant?: {
    name?: string;
    email?: string | null;
    phone?: string | null;
  };
}

export interface InfinitePayCheckoutResult {
  checkoutUrl: string;
  /** Referência guardada na Registration.paymentId (= order_nsu). */
  providerRef: string;
}

/**
 * Cria o checkout InfinitePay para uma inscrição já persistida (precisa do id
 * para usar como order_nsu). O repasse de taxa de cartão é configurado na conta
 * InfinitePay; enviamos o valor base e conciliamos pelo paid_amount no webhook.
 */
export async function createInfinitePayCheckoutForRegistration(
  params: InfinitePayCheckoutParams
): Promise<InfinitePayCheckoutResult> {
  const baseUrl = getAppBaseUrl();
  const priceInCents = Math.round(params.baseValue * 100);

  const { url } = await createInfinitePayCheckout({
    orderNsu: params.registrationId,
    items: [
      {
        quantity: 1,
        price: priceInCents,
        description: `Inscrição - ${params.eventTitle}`.slice(0, 120),
      },
    ],
    redirectUrl: `${baseUrl}/payment/success`,
    webhookUrl: `${baseUrl}/api/payments/webhook/infinitepay`,
    customer: params.participant
      ? {
          name: params.participant.name,
          email: params.participant.email ?? undefined,
          phone_number: params.participant.phone ?? undefined,
        }
      : undefined,
  });

  return { checkoutUrl: url, providerRef: params.registrationId };
}

export interface ParsedInfinitePayWebhook {
  /** order_nsu — id da Registration. */
  orderNsu: string;
  transactionNsu?: string;
  invoiceSlug?: string;
  /** Valor esperado (centavos) informado pelo InfinitePay. */
  amount?: number;
  /** Valor efetivamente pago (centavos), inclui repasse de taxa. */
  paidAmount?: number;
  installments?: number;
  captureMethod?: string;
  receiptUrl?: string;
}

/**
 * Normaliza o payload do webhook do InfinitePay. O InfinitePay só notifica
 * pagamentos aprovados, então o status resultante é sempre "confirmado".
 */
export function parseInfinitePayWebhook(
  payload: unknown
): ParsedInfinitePayWebhook | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;

  const orderNsu = typeof p.order_nsu === "string" ? p.order_nsu : undefined;
  if (!orderNsu) return null;

  return {
    orderNsu,
    transactionNsu:
      typeof p.transaction_nsu === "string" ? p.transaction_nsu : undefined,
    invoiceSlug: typeof p.invoice_slug === "string" ? p.invoice_slug : undefined,
    amount: typeof p.amount === "number" ? p.amount : undefined,
    paidAmount: typeof p.paid_amount === "number" ? p.paid_amount : undefined,
    installments:
      typeof p.installments === "number" ? p.installments : undefined,
    captureMethod:
      typeof p.capture_method === "string" ? p.capture_method : undefined,
    receiptUrl: typeof p.receipt_url === "string" ? p.receipt_url : undefined,
  };
}

/** Indica se o InfinitePay está configurado (handle presente). */
export function isInfinitePayConfigured(): boolean {
  return !!infinitePayConfig.handle;
}
