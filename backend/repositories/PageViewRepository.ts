import { prisma } from "../../lib/prisma";
import { BaseRepository } from "./BaseRepository";
import type { PageView as PrismaPageView } from "@prisma/client";

export type PageView = PrismaPageView;

export interface CreatePageViewData {
  page: string;
  referrer?: string;
  userAgent?: string;
  sessionId?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
}

export interface PageViewStats {
  page: string;
  count: number;
}

export class PageViewRepository extends BaseRepository<PageView> {
  constructor() {
    super(prisma.pageView);
  }

  async createPageView(data: CreatePageViewData): Promise<PageView> {
    try {
      return await prisma.pageView.create({
        data,
      });
    } catch (error) {
      console.error("Error creating page view:", error);
      throw new Error("Erro ao criar registro de visualização de página");
    }
  }

  async findByPage(
    page: string,
    options?: {
      skip?: number;
      take?: number;
    }
  ): Promise<PageView[]> {
    try {
      return await prisma.pageView.findMany({
        where: { page },
        orderBy: { createdAt: "desc" },
        ...options,
      });
    } catch (error) {
      console.error("Error finding page views by page:", error);
      throw new Error("Erro ao buscar visualizações por página");
    }
  }

  async findBySessionId(sessionId: string): Promise<PageView[]> {
    try {
      return await prisma.pageView.findMany({
        where: { sessionId },
        orderBy: { createdAt: "asc" },
      });
    } catch (error) {
      console.error("Error finding page views by session:", error);
      throw new Error("Erro ao buscar visualizações por sessão");
    }
  }

  async getPageStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<PageViewStats[]> {
    try {
      const where: any = {};
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const pageViews = await prisma.pageView.groupBy({
        by: ["page"],
        _count: {
          page: true,
        },
        where,
        orderBy: {
          _count: {
            page: "desc",
          },
        },
      });

      return pageViews.map((pv) => ({
        page: pv.page,
        count: pv._count.page,
      }));
    } catch (error) {
      console.error("Error getting page stats:", error);
      throw new Error("Erro ao buscar estatísticas de páginas");
    }
  }

  async getTotalViews(startDate?: Date, endDate?: Date): Promise<number> {
    try {
      const where: any = {};
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      return await prisma.pageView.count({ where });
    } catch (error) {
      console.error("Error getting total views:", error);
      throw new Error("Erro ao buscar total de visualizações");
    }
  }

  async getUniqueSessionCount(
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    try {
      const where: any = {};
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const result = await prisma.pageView.findMany({
        where,
        select: { sessionId: true },
        distinct: ["sessionId"],
      });

      return result.filter((r) => r.sessionId !== null).length;
    } catch (error) {
      console.error("Error getting unique session count:", error);
      throw new Error("Erro ao buscar contagem de sessões únicas");
    }
  }
}
