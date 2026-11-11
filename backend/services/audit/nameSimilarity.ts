const CONNECTORS = new Set(["de", "da", "do", "das", "dos", "e"]);

/** Minúsculas, sem acentos e sem pontuação. */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return normalizeName(value)
    .split(" ")
    .filter((t) => t.length > 1 && !CONNECTORS.has(t));
}

/**
 * Similaridade 0–1 por tokens (Dice). Primeiro e último nome iguais já contam
 * como nome semelhante, mesmo que um dos lados tenha nomes do meio a mais.
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setB = new Set(tb);
  const common = ta.filter((t) => setB.has(t)).length;
  const dice = (2 * common) / (ta.length + tb.length);
  const firstLastMatch =
    ta.length > 1 &&
    tb.length > 1 &&
    ta[0] === tb[0] &&
    ta[ta.length - 1] === tb[tb.length - 1];
  return firstLastMatch ? Math.max(dice, 0.85) : dice;
}
