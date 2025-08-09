import { prisma } from "../../lib/prisma";
import { BaseRepository } from "./BaseRepository";
import type { Registration as PrismaRegistration } from "@prisma/client";

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
  bannerUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type Registration = PrismaRegistration;

export interface EventWithStats extends Event {
  _count?: {
    registrations: number;
  };
  registrations?: Registration[];
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
      const availableSpots = event.maxParticipants - confirmedRegistrations;

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

      if (!event || !event.isActive) return false;

      const now = new Date();
      const isWithinRegistrationPeriod =
        now >= event.registrationStartDate && now <= event.registrationEndDate;

      const hasAvailableSpots =
        event._count.registrations < event.maxParticipants;

      return isWithinRegistrationPeriod && hasAvailableSpots;
    } catch (error) {
      console.error("Error checking if registration is open:", error);
      throw new Error("Erro ao verificar se inscrições estão abertas");
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
