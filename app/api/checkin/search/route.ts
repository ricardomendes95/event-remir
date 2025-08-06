import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const searchSchema = z.object({
  query: z.string().min(1, "Termo de busca é obrigatório"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = searchSchema.parse(body);

    // Limpar o termo de busca
    const cleanQuery = query.trim();
    const cleanCpf = cleanQuery.replace(/\D/g, "");

    // Buscar inscrições confirmadas que correspondam ao termo
    const registrations = await prisma.registration.findMany({
      where: {
        AND: [
          { status: "CONFIRMED" }, // Apenas confirmadas
          {
            OR: [
              { name: { contains: cleanQuery, mode: "insensitive" } },
              { email: { contains: cleanQuery, mode: "insensitive" } },
              ...(cleanCpf.length >= 3
                ? [{ cpf: { contains: cleanCpf } }]
                : []),
            ],
          },
        ],
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
      orderBy: [
        { checkedInAt: "desc" }, // Check-ins mais recentes primeiro
        { name: "asc" }, // Depois por nome
      ],
      take: 50, // Limitar resultados
    });

    return NextResponse.json({
      success: true,
      data: {
        items: registrations,
        total: registrations.length,
      },
    });
  } catch (error) {
    console.error("Erro na busca para check-in:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Termo de busca inválido",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
