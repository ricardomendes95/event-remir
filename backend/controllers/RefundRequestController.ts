import { NextRequest, NextResponse } from "next/server";
import { BaseController } from "./BaseController";
import { FULL_ACCESS_ROLES, type AdminRole } from "@/lib/permissions";
import {
  AdminRefundActionSchema,
  AdminRefundListQuerySchema,
} from "@/backend/schemas/refundSchemas";
import {
  applyAdminAction,
  listRefundRequests,
} from "@/backend/services/refundService";
import { serviceFailureResponse } from "@/backend/utils/validationResponse";

/** Solicitações de estorno: exclusivas de ADMIN/SUPER_ADMIN (ADR-003, Q9). */
const FORBIDDEN_MESSAGE =
  "Acesso negado - apenas Admin e Super Admin gerenciam estornos";

export class RefundRequestController extends BaseController {
  private isFullAccess(request: NextRequest): boolean {
    const role = request.headers.get("x-user-role") as AdminRole | null;
    return !!role && FULL_ACCESS_ROLES.includes(role);
  }

  async list(request: NextRequest): Promise<NextResponse> {
    try {
      if (!this.isFullAccess(request)) return this.forbidden(FORBIDDEN_MESSAGE);
      const query = AdminRefundListQuerySchema.parse(
        this.getQueryParams(request)
      );
      const result = await listRefundRequests(query);
      return this.success({
        items: result.items,
        activeCount: result.activeCount,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: result.total,
        },
      });
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(request: NextRequest, id: string): Promise<NextResponse> {
    try {
      const user = this.extractUserFromRequest(request);
      if (!user || !this.isFullAccess(request)) {
        return this.forbidden(FORBIDDEN_MESSAGE);
      }
      const body = AdminRefundActionSchema.parse(
        await this.getRequestBody(request)
      );
      const result = await applyAdminAction(id, user.id, body);
      if (!result.ok) return serviceFailureResponse(result);
      return this.success(result.item, "Solicitação atualizada");
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export const refundRequestController = new RefundRequestController();
