import { NextRequest, NextResponse } from "next/server";
import { getEventBatchState } from "@/backend/services/eventBatchService";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { zodErrorResponse } from "@/backend/utils/validationResponse";
import { AdminRegistrationCreateSchema } from "@/backend/schemas/registrationSchemas";
import { validateShirtSelection } from "@/backend/utils/shirtPricing";
import {
  sanitizeRegistrationForRole,
  sanitizeRegistrationsForRole,
} from "@/backend/utils/registrationSerializer";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status");
    const eventId = searchParams.get("eventId");
    const search = searchParams.get("search");

    // Construir filtros
    const where: Prisma.RegistrationWhereInput = {};

    if (status && status !== "ALL") {
      where.status = status as "PENDING" | "CONFIRMED" | "CANCELLED";
    }

    if (eventId && eventId !== "ALL") {
      where.eventId = eventId;
    }

    if (search) {
      const searchConditions: Prisma.RegistrationWhereInput[] = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { event: { title: { contains: search, mode: "insensitive" } } },
      ];

      // Só adicionar busca por CPF se houver dígitos
      const cleanCpf = search.replace(/\D/g, "");
      if (cleanCpf) {
        searchConditions.push({ cpf: { contains: cleanCpf } });
      }

      where.OR = searchConditions;
    }

    // Buscar inscrições com paginação usando helper de retry
    const [registrations, total] = await withPrismaRetry(async () =>
      Promise.all([
        prisma.registration.findMany({
          where,
          include: {
            batch: { select: { id: true, name: true } },
            // Compra em grupo: o responsável é a inscrição mais antiga do pedido
            order: {
              select: {
                id: true,
                status: true,
                registrations: {
                  select: { id: true, name: true },
                  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                  take: 1,
                },
                _count: { select: { registrations: true } },
              },
            },
            event: {
              select: {
                id: true,
                title: true,
                price: true,
                startDate: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.registration.count({ where }),
      ])
    );

    // CHECKIN/SUPPORT não veem valores financeiros (ADR-002)
    const items = sanitizeRegistrationsForRole(
      registrations,
      request.headers.get("x-user-role")
    );

    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Erro ao buscar inscrições:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

const EVENT_SELECT = {
  id: true,
  title: true,
  price: true,
  startDate: true,
} as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = AdminRegistrationCreateSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const {
      name,
      email,
      cpf,
      phone,
      eventId,
      status,
      paymentMethod,
      dynamicFormData,
      wantsShirt,
      shirtSize,
      notes,
      manualPaymentType,
      cashResponsible,
    } = parsed.data;
    const cpfDigits = cpf.replace(/\D/g, "");

    // Validar se o evento existe
    const event = await withPrismaRetry(() =>
      prisma.event.findUnique({ where: { id: eventId } })
    );

    if (!event) {
      return NextResponse.json(
        { success: false, error: "Evento não encontrado" },
        { status: 404 }
      );
    }

    // Validar seleção de camisa (quando o evento oferece)
    const shirtSelection = validateShirtSelection(event, {
      wantsShirt,
      shirtSize,
    });
    if (!shirtSelection.ok) {
      return NextResponse.json(
        { success: false, error: shirtSelection.error || "Seleção de camisa inválida" },
        { status: 422 }
      );
    }

    // Verificar se já existe inscrição com este CPF para o evento
    const existingRegistration = await withPrismaRetry(() =>
      prisma.registration.findFirst({
        where: { cpf: cpfDigits, eventId },
      })
    );

    if (existingRegistration) {
      return NextResponse.json(
        {
          success: false,
          error: "Já existe uma inscrição para este CPF neste evento",
        },
        { status: 400 }
      );
    }

    // A inscrição manual entra no lote vigente (sem lote vigente, fica sem lote)
    const batchState = await withPrismaRetry(() =>
      getEventBatchState(prisma, eventId)
    );

    // Criar inscrição
    const registration = await withPrismaRetry(() =>
      prisma.registration.create({
        data: {
          name,
          email: email || null,
          cpf: cpfDigits,
          phone: phone ? phone.replace(/\D/g, "") : null,
          eventId,
          status,
          paymentId: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          paymentMethod,
          manualPaymentType: manualPaymentType ?? null,
          cashResponsible: cashResponsible ?? null,
          notes: notes ?? null,
          wantsShirt: shirtSelection.wantsShirt,
          shirtSize: shirtSelection.shirtSize,
          batchId: batchState.activeBatch?.id ?? null,
          ...(dynamicFormData
            ? { dynamicFormData: dynamicFormData as Prisma.InputJsonValue }
            : {}),
        },
        include: { event: { select: EVENT_SELECT } },
      })
    );

    return NextResponse.json({
      success: true,
      data: sanitizeRegistrationForRole(
        registration,
        request.headers.get("x-user-role")
      ),
      message: "Inscrição criada com sucesso",
    });
  } catch (error) {
    console.error("Erro ao criar inscrição:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
