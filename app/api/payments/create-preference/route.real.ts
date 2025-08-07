import { NextRequest, NextResponse } from "next/server";
import { Preference } from "mercadopago";
import {
  mercadoPagoClient,
  validateMercadoPagoConfig,
} from "@/lib/mercadopago";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schema de validação
const createPreferenceSchema = z.object({
  eventId: z.string().min(1, "ID do evento é obrigatório"),
  participantData: z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    email: z.string().email("Email inválido"),
    cpf: z.string().min(11, "CPF deve ter 11 dígitos"),
    phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  }),
});

export async function POST(request: NextRequest) {
  try {
    // Validar configuração do Mercado Pago
    validateMercadoPagoConfig();

    // Validar dados da requisição
    const body = await request.json();
    const { eventId, participantData } = createPreferenceSchema.parse(body);

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

    // Verificar se inscrições estão abertas
    const now = new Date();
    if (now < event.registrationStartDate || now > event.registrationEndDate) {
      return NextResponse.json(
        { error: "Período de inscrições encerrado" },
        { status: 400 }
      );
    }

    // Verificar se participante já está inscrito (apenas CPF é único)
    const existingRegistration = await prisma.registration.findFirst({
      where: {
        eventId,
        cpf: participantData.cpf,
      },
    });

    if (existingRegistration) {
      return NextResponse.json(
        { error: "CPF já possui inscrição neste evento" },
        { status: 400 }
      );
    }

    // Criar preferência no Mercado Pago
    const preference = new Preference(mercadoPagoClient);

    const preferenceData = {
      items: [
        {
          id: eventId,
          title: event.title,
          description: event.description,
          quantity: 1,
          unit_price: Number(event.price),
          currency_id: "BRL",
        },
      ],
      payer: {
        name: participantData.name,
        email: participantData.email,
        identification: {
          type: "CPF",
          number: participantData.cpf.replace(/\D/g, ""),
        },
        phone: {
          number: participantData.phone.replace(/\D/g, ""),
        },
      },
      back_urls: {
        success: `${process.env.NEXTAUTH_URL}/payment/success`,
        failure: `${process.env.NEXTAUTH_URL}/payment/failure`,
        pending: `${process.env.NEXTAUTH_URL}/payment/pending`,
      },
      auto_return: "approved",
      notification_url: `${process.env.NEXTAUTH_URL}/api/payments/webhook`,
      metadata: {
        event_id: eventId,
        participant_name: participantData.name,
        participant_email: participantData.email,
        participant_cpf: participantData.cpf,
        participant_phone: participantData.phone,
      },
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
    };

    const response = await preference.create({ body: preferenceData });

    // Criar registro temporário (pending)
    await prisma.registration.create({
      data: {
        eventId,
        name: participantData.name,
        email: participantData.email,
        cpf: participantData.cpf.replace(/\D/g, ""),
        phone: participantData.phone.replace(/\D/g, ""),
        status: "PENDING",
        paymentId: response.id,
      },
    });

    return NextResponse.json({
      success: true,
      preferenceId: response.id,
      checkoutUrl: response.init_point,
      sandboxCheckoutUrl: response.sandbox_init_point,
    });
  } catch (error) {
    console.error("Erro ao criar preferência:", error);

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
