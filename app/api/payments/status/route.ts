import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("paymentId");
    const registrationId = searchParams.get("registrationId");

    if (!paymentId && !registrationId) {
      return NextResponse.json(
        { error: "paymentId ou registrationId é obrigatório" },
        { status: 400 }
      );
    }

    // Buscar registro pelo ID da inscrição ou pela referência do provedor
    const registration = await withPrismaRetry(() =>
      registrationId
        ? prisma.registration.findUnique({
            where: { id: registrationId },
            include: { event: true },
          })
        : prisma.registration.findFirst({
            where: { paymentId },
            include: { event: true },
          })
    );

    if (!registration) {
      return NextResponse.json(
        { error: "Registro não encontrado" },
        { status: 404 }
      );
    }

    // A confirmação de pagamento chega exclusivamente pelo webhook do gateway.
    // Aqui retornamos o status persistido no banco.
    return NextResponse.json({
      success: true,
      status:
        registration.status === "CONFIRMED"
          ? "approved"
          : registration.status.toLowerCase(),
      registration: {
        id: registration.id,
        name: registration.name,
        email: registration.email,
        event: registration.event.title,
        status: registration.status,
      },
    });
  } catch (error) {
    console.error("Erro ao verificar status:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
