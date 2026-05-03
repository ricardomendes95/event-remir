import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const searchSchema = z
  .object({
    registrationId: z.string().optional().nullable(),
    paymentId: z.string().optional().nullable(),
  })
  .refine((data) => data.registrationId || data.paymentId, {
    message: "É necessário fornecer registrationId ou paymentId",
  });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { registrationId, paymentId } = searchSchema.parse(body);

    // Buscar inscrição por ID ou paymentId
    const registration = await prisma.registration.findFirst({
      where: registrationId ? { id: registrationId } : { paymentId: paymentId },
      include: {
        event: {
          select: {
            title: true,
            price: true,
            startDate: true,
            location: true,
            isFree: true,
            formMode: true,
            dynamicFormFields: true,
          },
        },
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
      paymentMethod: registration.paymentMethod,
      dynamicFormData: registration.dynamicFormData,
      registrationDate: registration.createdAt.toISOString(),
      event: {
        title: registration.event.title,
        price: Number(registration.event.price),
        date: registration.event.startDate.toISOString(),
        location: registration.event.location,
        isFree: registration.event.isFree,
        formMode: registration.event.formMode,
        dynamicFormFields: registration.event.dynamicFormFields,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Erro ao buscar inscrição:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Parâmetros inválidos", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
