import { NextRequest } from "next/server";
import { BaseController } from "./BaseController";
import { eventRepository, type EventWithStats } from "../repositories";
import { EventCreateSchema, EventUpdateSchema } from "../schemas/eventSchemas";

export class EventController extends BaseController {
  async getEvents(request: NextRequest) {
    try {
      const { skip, limit, page } = this.getPaginationParams(request);
      const active = this.getQueryParam(request, "active");
      const upcoming = this.getQueryParam(request, "upcoming");

      let events: EventWithStats[];
      let total: number;

      if (upcoming === "true") {
        events = await eventRepository.findUpcomingEvents();
        total = events.length;

        // Aplicar paginação manual para eventos upcoming
        events = events.slice(skip, skip + limit);
      } else if (active === "true") {
        events = await eventRepository.findActiveEvents();
        total = events.length;

        // Aplicar paginação manual para eventos ativos
        events = events.slice(skip, skip + limit);
      } else {
        const whereOptions =
          active === "false" ? { isActive: false } : undefined;

        events = (await eventRepository.findAll({
          skip,
          take: limit,
          where: whereOptions,
          orderBy: { createdAt: "desc" },
        })) as EventWithStats[];

        total = await eventRepository.count(whereOptions);
      }

      return this.paginatedResponse(
        events,
        total,
        page,
        limit,
        "Eventos encontrados"
      );
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getEventById(
    request: NextRequest,
    { params }: { params: { id: string } }
  ) {
    try {
      const { id } = params;
      const includeStats =
        this.getQueryParam(request, "includeStats") === "true";

      if (includeStats) {
        const event = await eventRepository.findBySlugWithRegistrations(id);
        if (!event) {
          return this.notFound("Evento não encontrado");
        }
        return this.success(event, "Evento encontrado");
      } else {
        const event = await eventRepository.findById(id);
        if (!event) {
          return this.notFound("Evento não encontrado");
        }
        return this.success(event, "Evento encontrado");
      }
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getEventBySlug(
    request: NextRequest,
    { params }: { params: { slug: string } }
  ) {
    try {
      const { slug } = params;
      const includeRegistrations =
        this.getQueryParam(request, "includeRegistrations") === "true";

      if (includeRegistrations) {
        const event = await eventRepository.findBySlugWithRegistrations(slug);
        if (!event) {
          return this.notFound("Evento não encontrado");
        }
        return this.success(event, "Evento encontrado");
      } else {
        const event = await eventRepository.findBySlug(slug);
        if (!event) {
          return this.notFound("Evento não encontrado");
        }
        return this.success(event, "Evento encontrado");
      }
    } catch (error) {
      return this.handleError(error);
    }
  }

  async createEvent(request: NextRequest) {
    try {
      this.requireAdmin(request);

      const body = await this.getRequestBody(request);
      const validatedData = EventCreateSchema.parse(body);

      // Verificar se já existe um evento com o mesmo slug
      const existingEvent = await eventRepository.findBySlug(
        validatedData.slug
      );
      if (existingEvent) {
        return this.conflict("Já existe um evento com este slug");
      }

      // Converter strings de data para objetos Date
      const eventData = {
        ...validatedData,
        startDate: new Date(validatedData.startDate),
        endDate: new Date(validatedData.endDate),
        registrationStartDate: new Date(validatedData.registrationStartDate),
        registrationEndDate: new Date(validatedData.registrationEndDate),
        bannerUrl: validatedData.bannerUrl || null,
      };

      const event = await eventRepository.create(eventData);

      return this.created(event, "Evento criado com sucesso");
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateEvent(
    request: NextRequest,
    { params }: { params: { id: string } }
  ) {
    try {
      this.requireAdmin(request);

      const { id } = params;
      const body = await this.getRequestBody(request);
      const validatedData = EventUpdateSchema.parse(body);

      // Verificar se o evento existe
      const existingEvent = await eventRepository.findById(id);
      if (!existingEvent) {
        return this.notFound("Evento não encontrado");
      }

      // Se o slug está sendo alterado, verificar se não há conflito
      if (validatedData.slug && validatedData.slug !== existingEvent.slug) {
        const eventWithSlug = await eventRepository.findBySlug(
          validatedData.slug
        );
        if (eventWithSlug) {
          return this.conflict("Já existe um evento com este slug");
        }
      }

      // Converter strings de data para objetos Date quando presentes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = { ...validatedData };
      if (updateData.startDate)
        updateData.startDate = new Date(updateData.startDate);
      if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);
      if (updateData.registrationStartDate)
        updateData.registrationStartDate = new Date(
          updateData.registrationStartDate
        );
      if (updateData.registrationEndDate)
        updateData.registrationEndDate = new Date(
          updateData.registrationEndDate
        );

      const updatedEvent = await eventRepository.update(id, updateData);

      return this.success(updatedEvent, "Evento atualizado com sucesso");
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deleteEvent(
    request: NextRequest,
    { params }: { params: { id: string } }
  ) {
    try {
      this.requireAdmin(request);

      const { id } = params;

      // Verificar se o evento existe
      const existingEvent = await eventRepository.findById(id);
      if (!existingEvent) {
        return this.notFound("Evento não encontrado");
      }

      // Verificar se há inscrições confirmadas
      const stats = await eventRepository.getEventStats(id);
      if (stats && stats.confirmedRegistrations > 0) {
        return this.badRequest(
          "Não é possível deletar um evento com inscrições confirmadas"
        );
      }

      await eventRepository.delete(id);

      return this.success(null, "Evento deletado com sucesso");
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getEventStats(
    request: NextRequest,
    { params }: { params: { id: string } }
  ) {
    try {
      this.requireAdmin(request);

      const { id } = params;

      const stats = await eventRepository.getEventStats(id);
      if (!stats) {
        return this.notFound("Evento não encontrado");
      }

      return this.success(stats, "Estatísticas do evento");
    } catch (error) {
      return this.handleError(error);
    }
  }

  async checkRegistrationStatus(
    request: NextRequest,
    { params }: { params: { id: string } }
  ) {
    try {
      const { id } = params;

      const isOpen = await eventRepository.isRegistrationOpen(id);
      const event = await eventRepository.findById(id);

      if (!event) {
        return this.notFound("Evento não encontrado");
      }

      const stats = await eventRepository.getEventStats(id);

      return this.success(
        {
          isRegistrationOpen: isOpen,
          event: {
            id: event.id,
            title: event.title,
            startDate: event.startDate,
            endDate: event.endDate,
            registrationStartDate: event.registrationStartDate,
            registrationEndDate: event.registrationEndDate,
            maxParticipants: event.maxParticipants,
            price: event.price,
          },
          stats,
        },
        "Status de inscrição do evento"
      );
    } catch (error) {
      return this.handleError(error);
    }
  }

  async toggleEventStatus(
    request: NextRequest,
    { params }: { params: { id: string } }
  ) {
    try {
      this.requireAdmin(request);

      const { id } = params;

      const existingEvent = await eventRepository.findById(id);
      if (!existingEvent) {
        return this.notFound("Evento não encontrado");
      }

      const updatedEvent = await eventRepository.update(id, {
        isActive: !existingEvent.isActive,
      });

      return this.success(
        updatedEvent,
        `Evento ${updatedEvent.isActive ? "ativado" : "desativado"} com sucesso`
      );
    } catch (error) {
      return this.handleError(error);
    }
  }
}
