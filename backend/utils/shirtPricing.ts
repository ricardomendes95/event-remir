import type { ShirtConfig } from "@/backend/schemas/eventSchemas";

/** Lê o shirtConfig (campo JSON) de um evento de forma segura. */
export function getShirtConfig(event: {
  shirtConfig?: unknown;
}): ShirtConfig | null {
  const cfg = event.shirtConfig as ShirtConfig | null | undefined;
  if (!cfg || typeof cfg !== "object" || !cfg.enabled) return null;
  return cfg;
}

/**
 * Calcula o valor base da inscrição no servidor (nunca confiar no cliente):
 * preço com camisa quando o participante optou por ela e a camisa está
 * habilitada; caso contrário, o preço base do evento.
 */
export function resolveBaseValue(
  event: { price: number; shirtConfig?: unknown },
  wantsShirt: boolean
): number {
  const shirt = getShirtConfig(event);
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
