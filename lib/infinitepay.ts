/**
 * Cliente do InfinitePay (Checkout Integrado / Link de Pagamento).
 *
 * Validação "lazy" (não quebra o build quando a env não está presente) e
 * helper de criação de checkout.
 *
 * Docs de referência: POST https://api.checkout.infinitepay.io/links
 *  body: { handle, redirect_url, webhook_url, order_nsu, items:[{quantity, price(centavos), description}] }
 *  resposta: { url }
 *  webhook: { invoice_slug, amount, paid_amount, installments, capture_method, transaction_nsu, order_nsu, receipt_url, items }
 */

// Endpoint sobrescrevível por env para permitir smoke tests com gateway mockado.
const INFINITEPAY_LINKS_ENDPOINT =
  process.env.INFINITEPAY_LINKS_ENDPOINT ||
  "https://api.checkout.infinitepay.io/links";

const handle = process.env.INFINITEPAY_HANDLE;

// Durante o build não validamos (permite deploy sem InfinitePay configurado)
const isBuildTime =
  process.env.NODE_ENV === "production" && !process.env.VERCEL_ENV;

if (!handle && !isBuildTime) {
  console.warn(
    "⚠️ INFINITEPAY_HANDLE não configurado - checkout InfinitePay indisponível"
  );
}

export const infinitePayConfig = {
  handle: process.env.INFINITEPAY_HANDLE,
};

// Observação: o Checkout InfinitePay NÃO envia assinatura/HMAC no webhook.
// A legitimidade é verificada no handler conferindo o order_nsu (pedido real)
// e o valor pago — ver app/api/payments/webhook/infinitepay/route.ts.

/** Lança erro se a configuração mínima do InfinitePay não existir. */
export function validateInfinitePayConfig() {
  if (!process.env.INFINITEPAY_HANDLE) {
    throw new Error(
      "Variável de ambiente do InfinitePay não configurada: INFINITEPAY_HANDLE"
    );
  }
  return true;
}

export interface InfinitePayItem {
  /** Quantidade do item. */
  quantity: number;
  /** Preço unitário em centavos. */
  price: number;
  /** Descrição exibida no checkout. */
  description: string;
}

export interface CreateInfinitePayCheckoutInput {
  /** Identificador do pedido no nosso sistema (usamos registration.id). */
  orderNsu: string;
  items: InfinitePayItem[];
  redirectUrl: string;
  webhookUrl: string;
  /** Dados opcionais do pagador, quando a API aceitar. */
  customer?: {
    name?: string;
    email?: string | null;
    phone_number?: string | null;
  };
}

export interface CreateInfinitePayCheckoutResult {
  /** URL do checkout para redirecionar o cliente. */
  url: string;
  /** Eco do order_nsu enviado. */
  orderNsu: string;
}

/**
 * Cria um link de checkout no InfinitePay e retorna a URL para redirecionar o cliente.
 */
export async function createInfinitePayCheckout(
  input: CreateInfinitePayCheckoutInput
): Promise<CreateInfinitePayCheckoutResult> {
  validateInfinitePayConfig();

  const body = {
    handle: process.env.INFINITEPAY_HANDLE,
    redirect_url: input.redirectUrl,
    webhook_url: input.webhookUrl,
    order_nsu: input.orderNsu,
    items: input.items,
    ...(input.customer ? { customer: input.customer } : {}),
  };

  const response = await fetch(INFINITEPAY_LINKS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Falha ao criar checkout InfinitePay (HTTP ${response.status}): ${text}`
    );
  }

  const data = (await response.json()) as { url?: string };

  if (!data?.url) {
    throw new Error(
      "Resposta inválida do InfinitePay: campo 'url' ausente no checkout"
    );
  }

  return { url: data.url, orderNsu: input.orderNsu };
}

// Endpoint sobrescrevível por env para smoke tests com gateway mockado.
const INFINITEPAY_PAYMENT_CHECK_ENDPOINT =
  process.env.INFINITEPAY_PAYMENT_CHECK_ENDPOINT ||
  "https://api.checkout.infinitepay.io/payment_check";

export interface InfinitePayPaymentCheckInput {
  orderNsu: string;
  transactionNsu: string;
  slug: string;
}

export interface InfinitePayPaymentCheckResult {
  paid: boolean;
  amount: number | null;
  paidAmount: number | null;
  installments: number | null;
  captureMethod: string | null;
}

/** Consulta pontual de um pagamento no InfinitePay (usada na auditoria). */
export async function checkInfinitePayPayment(
  input: InfinitePayPaymentCheckInput
): Promise<InfinitePayPaymentCheckResult> {
  validateInfinitePayConfig();

  const response = await fetch(INFINITEPAY_PAYMENT_CHECK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle: process.env.INFINITEPAY_HANDLE,
      order_nsu: input.orderNsu,
      transaction_nsu: input.transactionNsu,
      slug: input.slug,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar o InfinitePay (HTTP ${response.status})`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    paid: data.paid === true || data.success === true,
    amount: num(data.amount),
    paidAmount: num(data.paid_amount),
    installments: num(data.installments),
    captureMethod: typeof data.capture_method === "string" ? data.capture_method : null,
  };
}
