import type { ShirtConfig } from "@/backend/schemas/eventSchemas";

/** Lê o shirtConfig (campo JSON) de um evento de forma segura. */
export function getShirtConfig(event: {
  shirtConfig?: unknown;
}): ShirtConfig | null {
  const cfg = event.shirtConfig as ShirtConfig | null | undefined;
  if (!cfg || typeof cfg !== "object" || !cfg.enabled) return null;
  return cfg;
}

/** Preços do lote vigente usados no cálculo do valor da inscrição. */
export interface BatchPricing {
  price: number;
  priceWithShirt: number | null;
}

/**
 * Calcula o valor base da inscrição no servidor (nunca confiar no cliente):
 * preço com camisa quando o participante optou por ela e a camisa está
 * habilitada; caso contrário, o preço base. Com `batch`, os preços do lote
 * substituem os do evento.
 */
export function resolveBaseValue(
  event: { price: number; shirtConfig?: unknown },
  wantsShirt: boolean,
  batch?: BatchPricing | null
): number {
  const shirt = getShirtConfig(event);
  if (batch) {
    if (wantsShirt && shirt) return batch.priceWithShirt ?? shirt.priceWithShirt;
    return batch.price;
  }
  if (wantsShirt && shirt) return shirt.priceWithShirt;
  return event.price;
}

export interface ShirtSelectionResult {
  ok: boolean;
  error?: string;
  /** Valores normalizados a persistir na Registration. */
  wantsShirt: boolean;
  shirtSize: string | null;
}

/**
 * Valida a seleção de camisa de uma inscrição contra a configuração do evento.
 * - Se o evento não oferece camisa, ignora a escolha (wantsShirt = false).
 * - Se optou por camisa, o tamanho é obrigatório e deve estar entre os tamanhos válidos.
 */
export function validateShirtSelection(
  event: { shirtConfig?: unknown },
  input: { wantsShirt?: boolean; shirtSize?: string | null }
): ShirtSelectionResult {
  const shirt = getShirtConfig(event);

  if (!shirt) {
    return { ok: true, wantsShirt: false, shirtSize: null };
  }

  if (!input.wantsShirt) {
    return { ok: true, wantsShirt: false, shirtSize: null };
  }

  const size = (input.shirtSize ?? "").trim();
  if (!size) {
    return {
      ok: false,
      error: "Escolha o tamanho da camisa",
      wantsShirt: true,
      shirtSize: null,
    };
  }

  if (!shirt.sizes.includes(size)) {
    return {
      ok: false,
      error: "Tamanho de camisa inválido para este evento",
      wantsShirt: true,
      shirtSize: null,
    };
  }

  return { ok: true, wantsShirt: true, shirtSize: size };
}

/**
 * Valor da camisa comprada depois da inscrição: a diferença entre o preço com
 * camisa e o preço sem camisa do lote da inscrição (ou do evento, sem lote).
 * Mesmo valor que o participante teria pago se tivesse escolhido a camisa
 * na inscrição. 0 quando o evento não oferece camisa.
 */
export function resolveShirtOnlyValue(
  event: { price: number; shirtConfig?: unknown },
  batch?: BatchPricing | null
): number {
  if (!getShirtConfig(event)) return 0;
  const diff =
    resolveBaseValue(event, true, batch) - resolveBaseValue(event, false, batch);
  return Math.max(0, Math.round(diff * 100) / 100);
}

/** Compra posterior aberta: camisa habilitada e prazo (se houver) não vencido. */
export function isShirtPurchaseOpen(
  event: { shirtConfig?: unknown },
  now: Date = new Date()
): boolean {
  const shirt = getShirtConfig(event);
  if (!shirt) return false;
  if (!shirt.purchaseDeadline) return true;
  return now.getTime() <= new Date(shirt.purchaseDeadline).getTime();
}
