import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Params {
  id: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const registration = await prisma.registration.findUnique({
      where: { id: params.id },
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

    if (!registration) {
      return NextResponse.json(
        { success: false, error: "Inscrição não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: registration,
    });
  } catch (error) {
    console.error("Erro ao buscar inscrição:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const body = await request.json();
    const { name, email, cpf, phone, status } = body;

    // Verificar se a inscrição existe
    const existingRegistration = await prisma.registration.findUnique({
      where: { id: params.id },
    });

    if (!existingRegistration) {
      return NextResponse.json(
        { success: false, error: "Inscrição não encontrada" },
        { status: 404 }
      );
    }

    // Atualizar inscrição
    const updatedRegistration = await prisma.registration.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(cpf && { cpf: cpf.replace(/\D/g, "") }),
        ...(phone && { phone: phone.replace(/\D/g, "") }),
        ...(status && { status }),
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
      data: updatedRegistration,
      message: "Inscrição atualizada com sucesso",
    });
  } catch (error) {
    console.error("Erro ao atualizar inscrição:", error);
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
    // Verificar se a inscrição existe
    const existingRegistration = await prisma.registration.findUnique({
      where: { id: params.id },
    });

    if (!existingRegistration) {
      return NextResponse.json(
        { success: false, error: "Inscrição não encontrada" },
        { status: 404 }
      );
    }

    // Excluir inscrição
    await prisma.registration.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: "Inscrição excluída com sucesso",
    });
  } catch (error) {
    console.error("Erro ao excluir inscrição:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
