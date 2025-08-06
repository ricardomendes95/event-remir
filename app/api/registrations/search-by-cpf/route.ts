import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const searchSchema = z.object({
  cpf: z.string().min(11, "CPF deve ter 11 dígitos").max(11, "CPF inválido"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cpf } = searchSchema.parse(body);

    // Buscar inscrição por CPF
    const registration = await prisma.registration.findFirst({
      where: {
        cpf: cpf.replace(/\D/g, ""), // Remove formatação
      },
      include: {
        event: {
          select: {
            title: true,
            price: true,
            startDate: true,
            location: true,
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
