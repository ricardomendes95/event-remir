import { NextRequest, NextResponse } from 'next/server';
// import { Preference } from 'mercadopago';
// import { mercadoPagoClient, validateMercadoPagoConfig } from '@/lib/mercadopago';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Schema de validação
const createPreferenceSchema = z.object({
  eventId: z.string().min(1, 'ID do evento é obrigatório'),
  participantData: z.object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    cpf: z.string().min(11, 'CPF deve ter 11 dígitos'),
    phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  }),
});

export async function POST(request: NextRequest) {
  try {
    // ⚠️ MODO MOCKADO - REMOVER APÓS DEPLOY E CONFIGURAÇÃO DO MERCADO PAGO
    console.log('🔄 MODO MOCKADO: Simulando pagamento...');

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
        { error: 'Evento não encontrado' },
        { status: 404 }
      );
    }

    if (!event.isActive) {
      return NextResponse.json(
        { error: 'Evento não está ativo' },
        { status: 400 }
      );
    }

    // Verificar se ainda há vagas
    if (event._count.registrations >= event.maxParticipants) {
      return NextResponse.json(
        { error: 'Evento lotado' },
        { status: 400 }
      );
    }

    // Verificar se inscrições estão abertas
    const now = new Date();
    if (now < event.registrationStartDate || now > event.registrationEndDate) {
      return NextResponse.json(
        { error: 'Período de inscrições encerrado' },
        { status: 400 }
      );
    }

    // Verificar se participante já está inscrito
    const existingRegistration = await prisma.registration.findFirst({
      where: {
        eventId,
        OR: [
          { email: participantData.email },
          { cpf: participantData.cpf },
        ],
      },
    });

    if (existingRegistration) {
      return NextResponse.json(
        { error: 'Participante já inscrito neste evento' },
        { status: 400 }
      );
    }

    // 🎭 SIMULAÇÃO: Criar inscrição diretamente como CONFIRMADA
    const mockPaymentId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const registration = await prisma.registration.create({
      data: {
        eventId,
        name: participantData.name,
        email: participantData.email,
        cpf: participantData.cpf.replace(/\D/g, ''),
        phone: participantData.phone.replace(/\D/g, ''),
        status: 'CONFIRMED', // 🎭 MOCKADO: Direto como confirmado
        paymentId: mockPaymentId,
      },
    });

    console.log('✅ MOCKADO: Inscrição criada com sucesso:', registration.id);

    // 🎭 SIMULAÇÃO: Retornar URLs mockadas
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
    
    return NextResponse.json({
      success: true,
      preferenceId: mockPaymentId,
      checkoutUrl: `${baseUrl}/payment/success?payment_id=${mockPaymentId}&registration_id=${registration.id}`,
      sandboxCheckoutUrl: `${baseUrl}/payment/success?payment_id=${mockPaymentId}&registration_id=${registration.id}`,
      // 🎭 DADOS EXTRAS PARA DEBUG
      mockData: {
        registrationId: registration.id,
        participantName: participantData.name,
        eventTitle: event.title,
        status: 'CONFIRMED',
        message: '🎭 Pagamento simulado com sucesso!'
      }
    });

  } catch (error) {
    console.error('Erro ao criar inscrição (mockada):', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
