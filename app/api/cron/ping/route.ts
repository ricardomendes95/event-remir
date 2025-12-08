import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Esta rota será chamada pelo Vercel Cron Job a cada 6 dias
export async function GET(request: NextRequest) {
  try {
    // Verificar se a requisição vem do Vercel Cron
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Se houver um CRON_SECRET configurado, verificar a autenticação
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verificar conexão com o banco de dados
    await prisma.$queryRaw`SELECT 1`;

    // Obter estatísticas básicas (opcional)
    const [totalEvents, totalRegistrations, totalPageViews] = await Promise.all(
      [
        prisma.event.count(),
        prisma.registration.count(),
        prisma.pageView.count(),
      ]
    );

    const timestamp = new Date().toISOString();

    console.log(`[CRON] Ping executado em ${timestamp}`);
    console.log(`[CRON] Stats - Eventos: ${totalEvents}, Inscrições: ${totalRegistrations}, Page Views: ${totalPageViews}`);

    return NextResponse.json({
      success: true,
      message: "Ping executado com sucesso",
      timestamp,
      stats: {
        events: totalEvents,
        registrations: totalRegistrations,
        pageViews: totalPageViews,
      },
    });
  } catch (error) {
    console.error("[CRON] Erro ao executar ping:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erro ao executar ping",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
