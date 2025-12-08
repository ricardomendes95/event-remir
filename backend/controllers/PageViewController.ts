import { NextRequest, NextResponse } from "next/server";
import { BaseController } from "./BaseController";
import { PageViewRepository } from "../repositories/PageViewRepository";
import type { ApiResponse } from "./BaseController";

export class PageViewController extends BaseController {
  private pageViewRepository: PageViewRepository;

  constructor() {
    super();
    this.pageViewRepository = new PageViewRepository();
  }

  async trackPageView(request: NextRequest): Promise<NextResponse<ApiResponse>> {
    try {
      const body = (await this.getRequestBody(request)) as {
        page: string;
        referrer?: string;
        sessionId?: string;
        latitude?: number;
        longitude?: number;
        city?: string;
        country?: string;
      };

      if (!body.page) {
        return this.badRequest("URL da página é obrigatória");
      }

      // Capturar user agent do header
      const userAgent = request.headers.get("user-agent") || undefined;

      const pageView = await this.pageViewRepository.createPageView({
        page: body.page,
        referrer: body.referrer,
        userAgent,
        sessionId: body.sessionId,
        latitude: body.latitude,
        longitude: body.longitude,
        city: body.city,
        country: body.country,
      });

      return this.created(pageView, "Visualização registrada com sucesso");
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPageStats(request: NextRequest): Promise<NextResponse<ApiResponse>> {
    try {
      // Verifica se é admin (opcional - remover se não quiser autenticação)
      // this.requireAdmin(request);

      const startDateParam = this.getQueryParam(request, "startDate");
      const endDateParam = this.getQueryParam(request, "endDate");

      const startDate = startDateParam ? new Date(startDateParam) : undefined;
      const endDate = endDateParam ? new Date(endDateParam) : undefined;

      const [stats, totalViews, uniqueSessions] = await Promise.all([
        this.pageViewRepository.getPageStats(startDate, endDate),
        this.pageViewRepository.getTotalViews(startDate, endDate),
        this.pageViewRepository.getUniqueSessionCount(startDate, endDate),
      ]);

      return this.success({
        stats,
        totalViews,
        uniqueSessions,
      });
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPageViewsByPage(
    request: NextRequest
  ): Promise<NextResponse<ApiResponse>> {
    try {
      // Verifica se é admin (opcional)
      // this.requireAdmin(request);

      const page = this.getQueryParam(request, "page");
      if (!page) {
        return this.badRequest("Parâmetro 'page' é obrigatório");
      }

      const { skip, limit } = this.getPaginationParams(request);

      const pageViews = await this.pageViewRepository.findByPage(page, {
        skip,
        take: limit,
      });

      return this.success(pageViews);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getSessionHistory(
    request: NextRequest
  ): Promise<NextResponse<ApiResponse>> {
    try {
      const sessionId = this.getQueryParam(request, "sessionId");
      if (!sessionId) {
        return this.badRequest("Parâmetro 'sessionId' é obrigatório");
      }

      const pageViews = await this.pageViewRepository.findBySessionId(
        sessionId
      );

      return this.success(pageViews);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
