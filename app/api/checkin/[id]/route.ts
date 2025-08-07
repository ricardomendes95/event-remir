import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Params {
  id: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const params = await context.params;
    const registrationId = params.id;

    // Verificar se a inscrição existe e está confirmada
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        event: {
          select: {
            title: true,
            startDate: true,
          },
        },
      },
    });

    if (!registration) {
      return NextResponse.json(
        { success: false, error: "Inscrição não encontrada" },
        { status: 404 }
      );
    }

    if (registration.status !== "CONFIRMED") {
      return NextResponse.json(
        {
          success: false,
          error: "Apenas inscrições confirmadas podem fazer check-in",
        },
        { status: 400 }
      );
    }

    if (registration.checkedInAt) {
      return NextResponse.json(
        {
          success: false,
          error: "Check-in já foi realizado para esta inscrição",
        },
        { status: 400 }
      );
    }

    // Fazer check-in
    const updatedRegistration = await prisma.registration.update({
      where: { id: registrationId },
      data: {
        checkedInAt: new Date(),
      },
      include: {
        event: {
          select: {
            title: true,
            startDate: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedRegistration,
      message: "Check-in realizado com sucesso",
    });
  } catch (error) {
    console.error("Erro ao fazer check-in:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const registrationId = params.id;

    // Verificar se a inscrição existe
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      return NextResponse.json(
        { success: false, error: "Inscrição não encontrada" },
        { status: 404 }
      );
    }

    if (!registration.checkedInAt) {
      return NextResponse.json(
        { success: false, error: "Não há check-in para desfazer" },
        { status: 400 }
      );
    }

    // Desfazer check-in
    const updatedRegistration = await prisma.registration.update({
      where: { id: registrationId },
      data: {
        checkedInAt: null,
      },
      include: {
        event: {
          select: {
            title: true,
            startDate: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedRegistration,
      message: "Check-in desfeito com sucesso",
    });
  } catch (error) {
    console.error("Erro ao desfazer check-in:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
