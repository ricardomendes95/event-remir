import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { resolveBaseValue } from "@/backend/utils/shirtPricing";

const searchSchema = z.object({
  cpf: z.string().min(11, "CPF deve ter 11 dígitos").max(11, "CPF inválido"),
  eventId: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cpf, eventId } = searchSchema.parse(body);

    // Buscar inscrição por CPF dentro do evento específico
    const registration = await prisma.registration.findFirst({
      where: {
        cpf: cpf.replace(/\D/g, ""),
        ...(eventId ? { eventId } : {}),
      },
      include: {
        event: {
          select: {
            title: true,
            price: true,
            startDate: true,
            location: true,
            shirtConfig: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc", // Pega a inscrição mais recente
      },
    });

    if (!registration) {
      return NextResponse.json(
        { error: "Inscrição não encontrada" },
        { status: 404 }
      );
    }

    // Valor efetivamente pago pela inscrição (com camisa, se escolhida)
    const amountPaid = resolveBaseValue(
      {
        price: Number(registration.event.price),
        shirtConfig: registration.event.shirtConfig,
      },
      registration.wantsShirt ?? false
    );

    // Formatear resposta
    const response = {
      id: registration.id,
      name: registration.name,
      email: registration.email,
      cpf: registration.cpf,
      phone: registration.phone,
      status: registration.status,
      paymentId: registration.paymentId,
      registrationDate: registration.createdAt.toISOString(),
      wantsShirt: registration.wantsShirt ?? false,
      shirtSize: registration.shirtSize ?? null,
      eventHasShirt: !!(
        registration.event.shirtConfig as { enabled?: boolean } | null
      )?.enabled,
      amountPaid,
      event: {
        title: registration.event.title,
        price: Number(registration.event.price),
        date: registration.event.startDate.toISOString(),
        location: registration.event.location,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Erro ao buscar inscrição:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "CPF inválido", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
