import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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

    return NextResponse.json({
      success: true,
      data: {
        items: registrations,
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, cpf, phone, eventId, status = "CONFIRMED" } = body;

    // Validar se o evento existe
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json(
        { success: false, error: "Evento não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se já existe inscrição com este CPF para o evento
    const existingRegistration = await prisma.registration.findFirst({
      where: {
        cpf: cpf.replace(/\D/g, ""),
        eventId,
      },
    });

    if (existingRegistration) {
      return NextResponse.json(
        {
          success: false,
          error: "Já existe uma inscrição para este CPF neste evento",
        },
        { status: 400 }
      );
    }

    // Criar inscrição
    const registration = await prisma.registration.create({
      data: {
        name,
        email,
        cpf: cpf.replace(/\D/g, ""),
        phone: phone.replace(/\D/g, ""),
        eventId,
        status,
        paymentId: `manual_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            price: true,
            startDate: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: registration,
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
