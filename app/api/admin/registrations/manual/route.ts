import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schema de validação para inscrição manual
const manualRegistrationSchema = z.object({
  eventId: z.string().min(1, "ID do evento é obrigatório"),
  participantData: z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    email: z.string().email("Email inválido"),
    cpf: z.string().min(11, "CPF deve ter 11 dígitos"),
    phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  }),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]).default("CONFIRMED"),
});

export async function POST(request: NextRequest) {
  try {
    // Validar dados da requisição
    const body = await request.json();
    const { eventId, participantData, status } =
      manualRegistrationSchema.parse(body);

    // Buscar evento
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        _count: {
          select: {
            registrations: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Evento não encontrado" },
        { status: 404 }
      );
    }

    if (!event.isActive) {
      return NextResponse.json(
        { error: "Evento não está ativo" },
        { status: 400 }
      );
    }

    // Verificar se ainda há vagas
    if (event._count.registrations >= event.maxParticipants) {
      return NextResponse.json({ error: "Evento lotado" }, { status: 400 });
    }

    // Verificar se participante já está inscrito (apenas CPF é único)
    const existingRegistration = await prisma.registration.findFirst({
      where: {
        eventId,
        cpf: participantData.cpf.replace(/\D/g, ""),
      },
    });

    if (existingRegistration) {
      return NextResponse.json(
        { error: "CPF já possui inscrição neste evento" },
        { status: 400 }
      );
    }

    // Criar inscrição manual
    const registration = await prisma.registration.create({
      data: {
        eventId,
        name: participantData.name,
        email: participantData.email,
        cpf: participantData.cpf.replace(/\D/g, ""),
        phone: participantData.phone.replace(/\D/g, ""),
        status,
        paymentId: `manual_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
      },
    });

    console.log("✅ Inscrição manual criada com sucesso:", registration.id);

    return NextResponse.json({
      success: true,
      registration: {
        id: registration.id,
        name: registration.name,
        email: registration.email,
        status: registration.status,
        eventTitle: event.title,
      },
    });
  } catch (error) {
    console.error("Erro ao criar inscrição manual:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
