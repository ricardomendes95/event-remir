import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Buscar registros recentes para debug
    const registrations = await prisma.registration.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true,
        paymentId: true,
        status: true,
        paymentDetails: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    return NextResponse.json({
      message: "Debug de registros recentes",
      count: registrations.length,
      registrations: registrations.map((reg) => ({
        id: reg.id,
        name: reg.name,
        email: reg.email,
        cpf: reg.cpf,
        paymentId: reg.paymentId,
        status: reg.status,
        createdAt: reg.createdAt,
        updatedAt: reg.updatedAt,
        hasPaymentDetails: !!reg.paymentDetails,
        paymentDetailsPreview: reg.paymentDetails
          ? JSON.stringify(reg.paymentDetails).substring(0, 100) + "..."
          : null,
      })),
    });
  } catch (error) {
    console.error("Erro ao buscar registros:", error);
    return NextResponse.json(
      { error: "Erro ao buscar registros", details: error },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { paymentId } = await request.json();

    if (!paymentId) {
      return NextResponse.json(
        { error: "paymentId é obrigatório" },
        { status: 400 }
      );
    }

    // Buscar registros que contenham este paymentId
    const allRegistrations = await prisma.registration.findMany();

    const matchingRegistrations = allRegistrations.filter((reg) => {
      // Buscar no paymentId direto
      if (reg.paymentId === paymentId) return true;

      // Buscar nos paymentDetails
      if (reg.paymentDetails && typeof reg.paymentDetails === "string") {
        return reg.paymentDetails.includes(paymentId);
      }

      return false;
    });

    return NextResponse.json({
      searchedPaymentId: paymentId,
      foundRegistrations: matchingRegistrations.length,
      registrations: matchingRegistrations.map((reg) => ({
        id: reg.id,
        name: reg.name,
        email: reg.email,
        paymentId: reg.paymentId,
        status: reg.status,
        createdAt: reg.createdAt,
      })),
    });
  } catch (error) {
    console.error("Erro na busca:", error);
    return NextResponse.json(
      { error: "Erro na busca", details: error },
      { status: 500 }
    );
  }
}
