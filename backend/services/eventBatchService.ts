import type { Prisma, PrismaClient } from "@prisma/client";
import {
  OCCUPYING_STATUSES,
  countByBatch,
  resolveActiveBatch,
  type BatchData,
} from "@/backend/utils/eventBatches";

type Db = Prisma.TransactionClient | PrismaClient;

export interface EventBatchState {
  /** O evento tem lotes cadastrados (modo "com lotes"). */
  hasBatches: boolean;
  activeBatch: BatchData | null;
}

/** Inscrições que ocupam vaga no evento, ignorando opcionalmente uma delas. */
export async function countOccupiedSlots(
  db: Db,
  eventId: string,
  excludeRegistrationId?: string,
): Promise<number> {
  return db.registration.count({
    where: {
      eventId,
      status: { in: [...OCCUPYING_STATUSES] },
      ...(excludeRegistrationId ? { id: { not: excludeRegistrationId } } : {}),
    },
  });
}

/** Inscrições PENDING + CONFIRMED de um lote (para checar a quota de N vagas). */
export async function countBatchOccupied(
  db: Db,
  batchId: string,
): Promise<number> {
  return db.registration.count({
    where: { batchId, status: { in: [...OCCUPYING_STATUSES] } },
  });
}

/** Lote vigente do evento, contando vagas por lote só de PENDING + CONFIRMED. */
export async function getEventBatchState(
  db: Db,
  eventId: string,
  options: { excludeRegistrationId?: string; now?: Date } = {},
): Promise<EventBatchState> {
  const batches = await db.eventBatch.findMany({ where: { eventId } });
  if (batches.length === 0) return { hasBatches: false, activeBatch: null };

  const registrations = await db.registration.findMany({
    where: {
      eventId,
      batchId: { not: null },
      status: { in: [...OCCUPYING_STATUSES] },
      ...(options.excludeRegistrationId
        ? { id: { not: options.excludeRegistrationId } }
        : {}),
    },
    select: { batchId: true },
  });

  return {
    hasBatches: true,
    activeBatch: resolveActiveBatch(
      batches,
      countByBatch(registrations),
      options.now,
    ),
  };
}

export interface PublicBatchView {
  price: number;
  shirtConfig: unknown;
  /** Lote vigente (sem quotas nem contagens). Nulo se não houver. */
  activeBatch: {
    name: string;
    price: number;
    priceWithShirt: number | null;
    endDate: string;
    limitedByQuota: boolean;
  } | null;
  /** Evento tem lotes, mas nenhum está vigente: inscrições fechadas. */
  batchesClosed: boolean;
}

/**
 * Preço e lote vigente para as APIs públicas. Com lote vigente, `price` e
 * `shirtConfig.priceWithShirt` já saem com os valores do lote; sem lotes,
 * saem os do evento (comportamento anterior).
 */
export function buildPublicBatchView(
  event: { price: number; isFree: boolean; shirtConfig: unknown },
  batches: BatchData[],
  occupyingRegistrations: { batchId: string | null }[],
  now: Date = new Date(),
): PublicBatchView {
  const base = {
    price: Number(event.price),
    shirtConfig: event.shirtConfig,
  };
  if (event.isFree || batches.length === 0) {
    return { ...base, activeBatch: null, batchesClosed: false };
  }

  const batch = resolveActiveBatch(
    batches,
    countByBatch(occupyingRegistrations),
    now,
  );
  if (!batch) return { ...base, activeBatch: null, batchesClosed: true };

  const shirt = event.shirtConfig as { enabled?: boolean } | null;
  return {
    price: batch.price,
    shirtConfig:
      shirt && typeof shirt === "object" && batch.priceWithShirt != null
        ? { ...shirt, priceWithShirt: batch.priceWithShirt }
        : event.shirtConfig,
    activeBatch: {
      name: batch.name,
      price: batch.price,
      priceWithShirt: batch.priceWithShirt,
      endDate: batch.endDate.toISOString(),
      limitedByQuota: batch.quota !== null,
    },
    batchesClosed: false,
  };
}
