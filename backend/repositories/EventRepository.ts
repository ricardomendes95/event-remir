import { prisma, withPrismaRetry } from "../../lib/prisma";
import { BaseRepository } from "./BaseRepository";
import type {
  EventBatch,
  Prisma,
  Registration as PrismaRegistration,
} from "@prisma/client";
import type { EventBatchInput } from "../schemas/eventSchemas";
import { OCCUPYING_STATUSES } from "../utils/eventBatches";
import {
  countOccupiedSlots,
  getEventBatchState,
} from "../services/eventBatchService";

const batchesInclude = {
  batches: { orderBy: [{ priority: "asc" as const }, { startDate: "asc" as const }] },
};

function toBatchData(
  b: EventBatchInput,
  withShirt: boolean
): Omit<Prisma.EventBatchUncheckedCreateInput, "eventId" | "id"> {
  return {
    name: b.name,
    startDate: new Date(b.startDate),
    endDate: new Date(b.endDate),
    quota: b.quota ?? null,
    priority: b.priority ?? 0,
    price: b.price,
    // priceWithShirt só tem sentido quando o evento oferece camisa
    priceWithShirt: withShirt ? b.priceWithShirt ?? null : null,
    isActive: b.isActive ?? true,
  };
}

// Redefining types manually to match actual schema
export interface Event {
  id: string;
  title: string;
  description: string;
  slug: string;
  startDate: Date;
  endDate: Date;
  registrationStartDate: Date;
  registrationEndDate: Date;
  location: string;
  maxParticipants: number;
  price: number;
  isActive: boolean;
  isFree: boolean;
  formMode: "FIXED_ONLY" | "DYNAMIC_ONLY" | "BOTH";
  dynamicFormFields: unknown | null;
  bannerUrl: string | null;
  paymentConfig: unknown | null;
  shirtConfig: unknown | null;
  allowBatchRegistration: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type Registration = PrismaRegistration;

export interface EventWithStats extends Event {
  _count?: {
    registrations: number;
  };
  registrations?: Registration[];
  batches?: EventBatch[];
}

export class EventRepository extends BaseRepository<Event> {
  constructor() {
    super(prisma.event);
  }

  async findBySlug(slug: string): Promise<Event | null> {
    try {
      return await prisma.event.findUnique({
        where: { slug },
      });
    } catch (error) {
      console.error("Error finding event by slug:", error);
      throw new Error("Erro ao buscar evento por slug");
    }
  }

  async findBySlugWithRegistrations(
    slug: string
  ): Promise<EventWithStats | null> {
    try {
      return await prisma.event.findUnique({
        where: { slug },
        include: {
          registrations: true,
          _count: {
            select: {
              registrations: {
                where: {
                  status: "CONFIRMED",
                },
              },
            },
          },
        },
      });
    } catch (error) {
      console.error("Error finding event by slug with registrations:", error);
      throw new Error("Erro ao buscar evento com inscrições");
    }
  }

  async findActiveEvents(): Promise<EventWithStats[]> {
    try {
      return await prisma.event.findMany({
        where: {
          isActive: true,
          startDate: {
            gte: new Date(),
          },
        },
        include: {
          _count: {
            select: {
              registrations: {
                where: {
                  status: "CONFIRMED",
                },
              },
            },
          },
        },
        orderBy: {
          startDate: "asc",
        },
      });
    } catch (error) {
      console.error("Error finding active events:", error);
      throw new Error("Erro ao buscar eventos ativos");
    }
  }

  async findAllWithStats(options?: {
    skip?: number;
    take?: number;
    orderBy?: Record<string, "asc" | "desc">;
    where?: Record<string, unknown>;
  }): Promise<EventWithStats[]> {
    try {
      return await prisma.event.findMany({
        ...options,
        include: {
          ...batchesInclude,
          _count: {
            select: {
              registrations: {
                where: {
                  status: "CONFIRMED",
                },
              },
            },
          },
        },
      });
    } catch (error) {
      console.error("Error finding events with stats:", error);
      throw new Error("Erro ao buscar eventos com estatísticas");
    }
  }

  async findUpcomingEvents(): Promise<EventWithStats[]> {
    try {
      return await prisma.event.findMany({
        where: {
          isActive: true,
          registrationStartDate: {
            lte: new Date(),
          },
          registrationEndDate: {
            gte: new Date(),
          },
        },
        include: {
          _count: {
            select: {
              registrations: {
                where: {
                  status: "CONFIRMED",
                },
              },
            },
          },
        },
        orderBy: {
          startDate: "asc",
        },
      });
    } catch (error) {
      console.error("Error finding upcoming events:", error);
      throw new Error("Erro ao buscar eventos disponíveis para inscrição");
    }
  }

  async getEventStats(eventId: string): Promise<{
    totalRegistrations: number;
    confirmedRegistrations: number;
    checkedInRegistrations: number;
    availableSpots: number;
  } | null> {
    try {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          registrations: {
            select: {
              status: true,
              checkedInAt: true,
            },
          },
        },
      });

      if (!event) return null;

      const totalRegistrations = event.registrations.length;
      const confirmedRegistrations = event.registrations.filter(
        (r: { status: string }) => r.status === "CONFIRMED"
      ).length;
      const checkedInRegistrations = event.registrations.filter(
        (r: { checkedInAt: Date | null }) => r.checkedInAt !== null
      ).length;
      const occupied = event.registrations.filter((r: { status: string }) =>
        (OCCUPYING_STATUSES as readonly string[]).includes(r.status)
      ).length;
      const availableSpots = Math.max(event.maxParticipants - occupied, 0);

      return {
        totalRegistrations,
        confirmedRegistrations,
        checkedInRegistrations,
        availableSpots,
      };
    } catch (error) {
      console.error("Error getting event stats:", error);
      throw new Error("Erro ao buscar estatísticas do evento");
    }
  }

  async isRegistrationOpen(eventId: string): Promise<boolean> {
    try {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          isActive: true,
          registrationStartDate: true,
          registrationEndDate: true,
          maxParticipants: true,
        },
      });

      if (!event || !event.isActive) return false;

      const now = new Date();
      const isWithinRegistrationPeriod =
        now >= event.registrationStartDate && now <= event.registrationEndDate;

      const occupied = await countOccupiedSlots(prisma, eventId);
      const hasAvailableSpots = occupied < event.maxParticipants;

      // Evento com lotes só abre se houver um lote vigente
      const batchState = await getEventBatchState(prisma, eventId);
      const hasOpenBatch = !batchState.hasBatches || !!batchState.activeBatch;

      return isWithinRegistrationPeriod && hasAvailableSpots && hasOpenBatch;
    } catch (error) {
      console.error("Error checking if registration is open:", error);
      throw new Error("Erro ao verificar se inscrições estão abertas");
    }
  }

  async findByIdWithBatches(id: string): Promise<EventWithStats | null> {
    try {
      return await withPrismaRetry(() =>
        prisma.event.findUnique({ where: { id }, include: batchesInclude })
      );
    } catch (error) {
      console.error("Error finding event with batches:", error);
      throw new Error("Erro ao buscar evento");
    }
  }

  async createWithBatches(
    data: Record<string, unknown>,
    batches: EventBatchInput[],
    withShirt: boolean
  ): Promise<Event> {
    try {
      return await withPrismaRetry(() =>
        prisma.event.create({
          data: {
            ...(data as Prisma.EventUncheckedCreateInput),
            batches: { create: batches.map((b) => toBatchData(b, withShirt)) },
          },
          include: batchesInclude,
        })
      );
    } catch (error) {
      console.error("Error creating event with batches:", error);
      throw new Error("Erro ao criar registro");
    }
  }

  /**
   * Atualiza o evento e, quando `batches` é informado, sincroniza os lotes na
   * mesma transação (upsert por id; os ausentes são removidos).
   */
  async updateWithBatches(
    id: string,
    data: Record<string, unknown>,
    batches: EventBatchInput[] | undefined,
    withShirt: boolean
  ): Promise<Event> {
    try {
      return await withPrismaRetry(() =>
        prisma.$transaction(async (tx) => {
          if (batches) {
            const keepIds = batches.flatMap((b) => (b.id ? [b.id] : []));
            await tx.eventBatch.deleteMany({
              where: { eventId: id, id: { notIn: keepIds } },
            });
            for (const b of batches) {
              const batchData = toBatchData(b, withShirt);
              if (b.id) {
                await tx.eventBatch.update({ where: { id: b.id }, data: batchData });
              } else {
                await tx.eventBatch.create({ data: { ...batchData, eventId: id } });
              }
            }
          }
          return tx.event.update({
            where: { id },
            data: data as Prisma.EventUncheckedUpdateInput,
            include: batchesInclude,
          });
        })
      );
    } catch (error) {
      console.error("Error updating event with batches:", error);
      throw new Error("Erro ao atualizar registro");
    }
  }

  async updateSlug(id: string, newSlug: string): Promise<Event> {
    try {
      return await prisma.event.update({
        where: { id },
        data: { slug: newSlug },
      });
    } catch (error) {
      console.error("Error updating event slug:", error);
      throw new Error("Erro ao atualizar slug do evento");
    }
  }
}
