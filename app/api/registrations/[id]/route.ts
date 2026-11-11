import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShirtSelection } from "@/backend/utils/shirtPricing";
import { sanitizeRegistrationForRole } from "@/backend/utils/registrationSerializer";

interface Params {
  id: string;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const params = await context.params;
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
      // CHECKIN/SUPPORT não veem valores financeiros (ADR-002)
      data: sanitizeRegistrationForRole(
        registration,
        request.headers.get("x-user-role")
      ),
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
  context: { params: Promise<Params> }
) {
  try {
    const params = await context.params;
    const body = await request.json();
    const {
      name,
      email,
      cpf,
      phone,
      status,
      paymentMethod,
      dynamicFormData,
      wantsShirt,
      shirtSize,
    } = body;

    // Verificar se a inscrição existe (com o shirtConfig do evento p/ validação)
    const existingRegistration = await prisma.registration.findUnique({
      where: { id: params.id },
      include: { event: { select: { shirtConfig: true } } },
    });

    if (!existingRegistration) {
      return NextResponse.json(
        { success: false, error: "Inscrição não encontrada" },
        { status: 404 }
      );
    }

    // Validar seleção de camisa quando enviada
    const shirtProvided = wantsShirt !== undefined;
    const shirtSelection = shirtProvided
      ? validateShirtSelection(existingRegistration.event, {
          wantsShirt,
          shirtSize,
        })
      : null;
    if (shirtSelection && !shirtSelection.ok) {
      return NextResponse.json(
        {
          success: false,
          error: shirtSelection.error || "Seleção de camisa inválida",
        },
        { status: 422 }
      );
    }

    // Atualizar inscrição
    const updatedRegistration = await prisma.registration.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(email !== undefined && { email: email || null }),
        ...(cpf && { cpf: cpf.replace(/\D/g, "") }),
        ...(phone !== undefined && { phone: phone ? phone.replace(/\D/g, "") : null }),
        ...(status && { status }),
        ...(paymentMethod && { paymentMethod }),
        ...(dynamicFormData !== undefined && { dynamicFormData }),
        ...(shirtSelection
          ? {
              wantsShirt: shirtSelection.wantsShirt,
              shirtSize: shirtSelection.shirtSize,
            }
          : {}),
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
  context: { params: Promise<Params> }
) {
  try {
    const params = await context.params;
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
