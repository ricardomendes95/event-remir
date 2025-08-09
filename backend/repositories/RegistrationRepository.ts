import { prisma } from "../../lib/prisma";
import { BaseRepository } from "./BaseRepository";
import type { Registration as PrismaRegistration } from "@prisma/client";

// Tipos baseados no schema Prisma atualizado
export type Registration = PrismaRegistration;

export interface RegistrationWithEvent extends Registration {
  event: {
    id: string;
    title: string;
    startDate: Date;
    endDate: Date;
    location: string;
  };
}

export class RegistrationRepository extends BaseRepository<Registration> {
  constructor() {
    super(prisma.registration);
  }

  async findByEmail(email: string): Promise<Registration[]> {
    try {
      return await prisma.registration.findMany({
        where: { email },
      });
    } catch (error) {
      console.error("Error finding registrations by email:", error);
      throw new Error("Erro ao buscar inscrições por email");
    }
  }

  async findByCpf(cpf: string): Promise<Registration[]> {
    try {
      return await prisma.registration.findMany({
        where: { cpf },
      });
    } catch (error) {
      console.error("Error finding registrations by CPF:", error);
      throw new Error("Erro ao buscar inscrições por CPF");
    }
  }

  async findByEventId(
    eventId: string,
    options?: {
      status?: "PENDING" | "CONFIRMED" | "CANCELLED";
      checkedIn?: boolean;
      skip?: number;
      take?: number;
    }
  ): Promise<Registration[]> {
    try {
      const where: {
        eventId: string;
        status?: "PENDING" | "CONFIRMED" | "CANCELLED";
        checkedInAt?: object;
      } = { eventId };

      if (options?.status) {
        where.status = options.status;
      }

      if (options?.checkedIn !== undefined) {
        where.checkedInAt = options.checkedIn
          ? { not: null }
          : { equals: null };
      }

      return await prisma.registration.findMany({
        where,
        skip: options?.skip,
        take: options?.take,
        orderBy: {
          createdAt: "desc",
        },
      });
    } catch (error) {
      console.error("Error finding registrations by event:", error);
      throw new Error("Erro ao buscar inscrições do evento");
    }
  }

  async findByEventAndCpf(
    eventId: string,
    cpf: string
  ): Promise<Registration | null> {
    try {
      return await prisma.registration.findFirst({
        where: {
          eventId,
          cpf,
        },
      });
    } catch (error) {
      console.error("Error finding registration by event and CPF:", error);
      throw new Error("Erro ao buscar inscrição por evento e CPF");
    }
  }

  async findByEventAndEmail(
    eventId: string,
    email: string
  ): Promise<Registration | null> {
    try {
      return await prisma.registration.findFirst({
        where: {
          eventId,
          email,
        },
      });
    } catch (error) {
      console.error("Error finding registration by event and email:", error);
      throw new Error("Erro ao buscar inscrição por evento e email");
    }
  }

  async findByPaymentId(paymentId: string): Promise<Registration | null> {
    try {
      return await prisma.registration.findFirst({
        where: { paymentId },
      });
    } catch (error) {
      console.error("Error finding registration by payment ID:", error);
      throw new Error("Erro ao buscar inscrição por ID de pagamento");
    }
  }

  async findWithEvent(
    registrationId: string
  ): Promise<RegistrationWithEvent | null> {
    try {
      return await prisma.registration.findUnique({
        where: { id: registrationId },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              startDate: true,
              endDate: true,
              location: true,
            },
          },
        },
      });
    } catch (error) {
      console.error("Error finding registration with event:", error);
      throw new Error("Erro ao buscar inscrição com dados do evento");
    }
  }

  async updateStatus(
    id: string,
    status: "PENDING" | "CONFIRMED" | "CANCELLED"
  ): Promise<Registration> {
    try {
      return await prisma.registration.update({
        where: { id },
        data: { status },
      });
    } catch (error) {
      console.error("Error updating registration status:", error);
      throw new Error("Erro ao atualizar status da inscrição");
    }
  }

  async setPaymentId(id: string, paymentId: string): Promise<Registration> {
    try {
      return await prisma.registration.update({
        where: { id },
        data: {
          paymentId,
          status: "CONFIRMED",
        },
      });
    } catch (error) {
      console.error("Error setting payment ID:", error);
      throw new Error("Erro ao definir ID do pagamento");
    }
  }

  async checkIn(id: string): Promise<Registration> {
    try {
      return await prisma.registration.update({
        where: { id },
        data: {
          checkedInAt: new Date(),
        },
      });
    } catch (error) {
      console.error("Error checking in registration:", error);
      throw new Error("Erro ao fazer check-in");
    }
  }

  async checkOut(id: string): Promise<Registration> {
    try {
      return await prisma.registration.update({
        where: { id },
        data: {
          checkedInAt: null,
        },
      });
    } catch (error) {
      console.error("Error checking out registration:", error);
      throw new Error("Erro ao desfazer check-in");
    }
  }

  async getEventRegistrationStats(eventId: string): Promise<{
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    checkedIn: number;
  }> {
    try {
      const registrations = await prisma.registration.findMany({
        where: { eventId },
        select: {
          status: true,
          checkedInAt: true,
        },
      });

      const stats = {
        total: registrations.length,
        confirmed: 0,
        pending: 0,
        cancelled: 0,
        checkedIn: 0,
      };

      registrations.forEach(
        (reg: { status: string; checkedInAt: Date | null }) => {
          switch (reg.status) {
            case "CONFIRMED":
              stats.confirmed++;
              break;
            case "PENDING":
              stats.pending++;
              break;
            case "CANCELLED":
              stats.cancelled++;
              break;
          }

          if (reg.checkedInAt) {
            stats.checkedIn++;
          }
        }
      );

      return stats;
    } catch (error) {
      console.error("Error getting event registration stats:", error);
      throw new Error("Erro ao buscar estatísticas de inscrições");
    }
  }

  async getUserRegistrations(email: string): Promise<RegistrationWithEvent[]> {
    try {
      return await prisma.registration.findMany({
        where: { email },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              startDate: true,
              endDate: true,
              location: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } catch (error) {
      console.error("Error getting user registrations:", error);
      throw new Error("Erro ao buscar inscrições do usuário");
    }
  }
}
