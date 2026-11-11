/** Status de inscrição que ocupam vaga (global e por lote). */
export const OCCUPYING_STATUSES = ["PENDING", "CONFIRMED"] as const;

export interface BatchData {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  quota: number | null;
  priority: number;
  price: number;
  priceWithShirt: number | null;
  isActive: boolean;
}

/** Conta inscrições que ocupam vaga por lote. */
export function countByBatch(
  registrations: { batchId: string | null }[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of registrations) {
    if (r.batchId) counts[r.batchId] = (counts[r.batchId] ?? 0) + 1;
  }
  return counts;
}

/**
 * Resolve o lote vigente (fonte única, sempre no servidor): ativo, dentro do
 * período e com vaga. Em caso de mais de um, vence a menor prioridade.
 */
export function resolveActiveBatch<T extends BatchData>(
  batches: T[],
  counts: Record<string, number>,
  now: Date = new Date(),
): T | null {
  const candidates = batches
    .filter(
      (b) =>
        b.isActive &&
        now >= b.startDate &&
        now <= b.endDate &&
        (b.quota === null || (counts[b.id] ?? 0) < b.quota),
    )
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        a.startDate.getTime() - b.startDate.getTime(),
    );
  return candidates[0] ?? null;
}
