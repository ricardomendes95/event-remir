import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { checkInfinitePayPayment } from "@/lib/infinitepay";
import { ORDER_NSU_PREFIX } from "@/backend/services/payment/infinitePayService";
import { AuditError } from "@/backend/services/audit/auditService";
import { auditErrorResponse, denyIfNotAdmin } from "@/backend/services/audit/routeHelpers";

const Schema = z
  .object({
    registrationId: z.string().min(1).optional(),
    orderId: z.string().min(1).optional(),
  })
  .refine((v) => !!v.registrationId !== !!v.orderId, {
    message: "Informe uma inscrição ou um pedido",
  });

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

// POST /api/admin/audit/payment-check - Consulta pontual do pagamento no InfinitePay
export async function POST(request: NextRequest) {
  const denied = denyIfNotAdmin(request);
  if (denied) return denied;
  try {
    const body = Schema.parse(await request.json().catch(() => null));

    let orderNsu: string;
    let transactionNsu: string | null;
    let slug: string | null;
    if (body.orderId) {
      const order = await withPrismaRetry(() =>
        prisma.order.findUnique({ where: { id: body.orderId! } })
      );
      if (!order) throw new AuditError("Pedido não encontrado", 404);
      const details = (order.paymentDetails ?? {}) as Record<string, unknown>;
      orderNsu = `${ORDER_NSU_PREFIX}${order.id}`;
      transactionNsu = order.transactionNsu ?? str(details.transactionNsu);
      slug = order.invoiceSlug ?? str(details.invoiceSlug);
    } else {
      const reg = await withPrismaRetry(() =>
        prisma.registration.findUnique({ where: { id: body.registrationId! } })
      );
      if (!reg) throw new AuditError("Inscrição não encontrada", 404);
      const details = (reg.paymentDetails ?? {}) as Record<string, unknown>;
      orderNsu = reg.id;
      transactionNsu = str(details.transactionNsu);
      slug = str(details.invoiceSlug);
    }
    if (!transactionNsu || !slug) {
      throw new AuditError(
        "Este pagamento não tem os dados necessários para consulta no InfinitePay.",
        422
      );
    }

    const result = await checkInfinitePayPayment({ orderNsu, transactionNsu, slug });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Falha ao consultar")) {
      return NextResponse.json(
        { success: false, error: "Não foi possível consultar o InfinitePay agora. Tente de novo em instantes." },
        { status: 502 }
      );
    }
    return auditErrorResponse(error);
  }
}
