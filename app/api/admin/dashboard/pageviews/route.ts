import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const pvStart = searchParams.get("start")
      ? new Date(searchParams.get("start")!)
      : defaultStart;
    const pvEnd = searchParams.get("end") ? new Date(searchParams.get("end")!) : now;

    const where = { createdAt: { gte: pvStart, lte: pvEnd } };

    const [totalViews, topPagesRaw] = await withPrismaRetry(() =>
      Promise.all([
        prisma.pageView.count({ where }),
        prisma.pageView.groupBy({
          by: ["page"],
          where,
          _count: { page: true },
          orderBy: { _count: { page: "desc" } },
          take: 5,
        }),
      ])
    );

    const topPages = topPagesRaw.map((r) => ({
      page: r.page,
      count: r._count.page,
    }));

    return NextResponse.json({
      success: true,
      data: { totalViews, topPages },
    });
  } catch (error) {
    console.error("Erro ao buscar page views:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
