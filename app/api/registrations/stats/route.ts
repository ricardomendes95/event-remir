import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { buildRegistrationWhere } from "@/backend/utils/registrationFilters";
import { resolveBaseValue } from "@/backend/utils/shirtPricing";
import {
  canViewFinancialValues,
  canViewRegistrationNotes,
} from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    // Mesmos filtros da listagem, exceto a busca textual
    const where = buildRegistrationWhere(searchParams, { includeSearch: false });

    // Buscar estatísticas usando helper de retry
    const [totalCount, confirmedCount, pendingCount, cancelledCount] =
      await withPrismaRetry(async () => {
        if (status && status !== "ALL") {
          // Se tem filtro de status específico, só conta esse status
          const count = await prisma.registration.count({ where });
          return [
            count,
            status === "CONFIRMED" ? count : 0,
            status === "PENDING" ? count : 0,
            status === "CANCELLED" ? count : 0,
          ];
        } else {
          // Se não tem filtro de status, conta todos os status
          return Promise.all([
            prisma.registration.count({ where }),
            prisma.registration.count({
              where: { ...where, status: "CONFIRMED" },
            }),
            prisma.registration.count({
              where: { ...where, status: "PENDING" },
            }),
            prisma.registration.count({
              where: { ...where, status: "CANCELLED" },
            }),
          ]);
        }
      });

    // CHECKIN/SUPPORT não veem receita (ADR-002) — nem calculamos
    const role = request.headers.get("x-user-role");
    const showFinancials = canViewFinancialValues(role);

    // Pagamento manual por sub-método (contagem, não é valor) e observações
    // (CHECKIN não vê observação — ver canViewRegistrationNotes).
    const [manualGroups, withNotes, openRefunds] = await withPrismaRetry(() =>
      Promise.all([
        prisma.registration.groupBy({
          by: ["manualPaymentType"],
          where: { ...where, paymentMethod: "MANUAL" },
          _count: { _all: true },
        }),
        canViewRegistrationNotes(role)
          ? prisma.registration.count({
              where: { ...where, notes: { not: null } },
            })
          : Promise.resolve(null),
        showFinancials
          ? prisma.refundRequest.count({
              where: {
                status: { in: ["OPEN", "IN_CONTACT"] },
                registration: where,
              },
            })
          : Promise.resolve(null),
      ])
    );
    const manualByType = { PIX: 0, CASH: 0, CARD: 0, NOT_INFORMED: 0 };
    for (const group of manualGroups) {
      manualByType[group.manualPaymentType ?? "NOT_INFORMED"] +=
        group._count._all;
    }
    const extras = { manualByType, withNotes, openRefunds };

    if (!showFinancials) {
      return NextResponse.json({
        success: true,
        data: {
          total: totalCount,
          confirmed: confirmedCount,
          pending: pendingCount,
          cancelled: cancelledCount,
          totalRevenue: null,
          nonManualRevenue: null,
          ...extras,
        },
      });
    }

    // Calcular receita total e receita não-manual usando helper de retry.
    // Receita bruta por inscrição = valor base do evento (com camisa, se o
    // participante optou). As taxas do InfinitePay são resolvidas na conta do
    // gateway, então não são descontadas aqui.
    const [totalRevenue, nonManualRevenue] = await withPrismaRetry(async () => {
      const confirmedRegistrations = await prisma.registration.findMany({
        where: { ...where, status: "CONFIRMED" },
        select: {
          event: {
            select: {
              price: true,
              shirtConfig: true,
            },
          },
          wantsShirt: true,
          batch: { select: { price: true, priceWithShirt: true } },
          paymentMethod: true,
        },
      });

      let total = 0;
      let nonManualTotal = 0;

      for (const reg of confirmedRegistrations) {
        const revenue = resolveBaseValue(
          reg.event,
          reg.wantsShirt ?? false,
          reg.batch
        );

        total += revenue;
        if (reg.paymentMethod !== "MANUAL") {
          nonManualTotal += revenue;
        }
      }

      return [
        Math.round(total * 100) / 100,
        Math.round(nonManualTotal * 100) / 100,
      ];
    });

    return NextResponse.json({
      success: true,
      data: {
        total: totalCount,
        confirmed: confirmedCount,
        pending: pendingCount,
        cancelled: cancelledCount,
        totalRevenue,
        nonManualRevenue,
        ...extras,
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
