import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const eventId = searchParams.get("eventId");
    const search = searchParams.get("search");

    // Construir filtros (mesmo filtro usado na listagem)
    const where: Prisma.RegistrationWhereInput = {};

    if (status && status !== "ALL") {
      where.status = status as "PENDING" | "CONFIRMED" | "CANCELLED";
    }

    if (eventId && eventId !== "ALL") {
      where.eventId = eventId;
    }

    if (search) {
      const searchConditions: Prisma.RegistrationWhereInput[] = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { event: { title: { contains: search, mode: "insensitive" } } },
      ];

      // Só adicionar busca por CPF se houver dígitos
      const cleanCpf = search.replace(/\D/g, "");
      if (cleanCpf) {
        searchConditions.push({ cpf: { contains: cleanCpf } });
      }

      where.OR = searchConditions;
    }

    // Buscar estatísticas com agregações do Prisma
    // Para as contagens por status, quando há filtro de status aplicado,
    // só mostramos a contagem do status filtrado, os outros ficam como 0
    let totalCount, confirmedCount, pendingCount, cancelledCount;

    if (status && status !== "ALL") {
      // Se tem filtro de status específico, só conta esse status
      totalCount = await prisma.registration.count({ where });
      confirmedCount = status === "CONFIRMED" ? totalCount : 0;
      pendingCount = status === "PENDING" ? totalCount : 0;
      cancelledCount = status === "CANCELLED" ? totalCount : 0;
    } else {
      // Se não tem filtro de status, conta todos os status
      [totalCount, confirmedCount, pendingCount, cancelledCount] =
        await Promise.all([
          prisma.registration.count({ where }),
          prisma.registration.count({
            where: { ...where, status: "CONFIRMED" },
          }),
          prisma.registration.count({ where: { ...where, status: "PENDING" } }),
          prisma.registration.count({
            where: { ...where, status: "CANCELLED" },
          }),
        ]);
    }

    // Calcular receita total das registrations confirmadas dentro dos filtros aplicados
    const confirmedRegistrations = await prisma.registration.findMany({
      where: { ...where, status: "CONFIRMED" },
      select: {
        event: {
          select: {
            price: true,
          },
        },
      },
    });

    const totalRevenue = confirmedRegistrations.reduce(
      (sum, registration) => sum + registration.event.price,
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        total: totalCount,
        confirmed: confirmedCount,
        pending: pendingCount,
        cancelled: cancelledCount,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
