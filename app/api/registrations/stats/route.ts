import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  PaymentFeeCalculator,
  PaymentConfig,
} from "@/backend/utils/paymentFeeCalculator";

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

    // Calcular receita total usando helper de retry

    // Receita líquida considerando taxas e repasse
    const totalRevenue = await withPrismaRetry(async () => {
      const confirmedRegistrations = await prisma.registration.findMany({
        where: { ...where, status: "CONFIRMED" },
        select: {
          event: {
            select: {
              price: true,
              paymentConfig: true,
            },
          },
          paymentDetails: true,
        },
      });

      let total = 0;
      for (const reg of confirmedRegistrations) {
        // Valor base
        const baseValue = reg.event.price;
        // Tenta extrair método, parcelas e valor do paymentDetails
        let method = "pix";
        let installments = 1;
        let paymentConfig: PaymentConfig | undefined = undefined;
        if (reg.event.paymentConfig) {
          if (typeof reg.event.paymentConfig === "string") {
            try {
              paymentConfig = JSON.parse(reg.event.paymentConfig);
            } catch {
              paymentConfig = undefined;
            }
          } else {
            paymentConfig = reg.event.paymentConfig as PaymentConfig;
          }
        }
        let amountPaid = baseValue;

        if (reg.paymentDetails) {
          try {
            const details =
              typeof reg.paymentDetails === "string"
                ? JSON.parse(reg.paymentDetails)
                : reg.paymentDetails;
            if (details.method) method = details.method;
            if (details.installments) installments = details.installments;
            if (typeof details.amountPaid === "number")
              amountPaid = details.amountPaid;
            // passthrough_fee não é necessário aqui, pois o cálculo já é feito pelo PaymentFeeCalculator
          } catch {}
        }

        // Calcula opções de pagamento para o evento
        let calc: ReturnType<
          typeof PaymentFeeCalculator.calculatePaymentOptions
        >;
        try {
          calc = PaymentFeeCalculator.calculatePaymentOptions(
            amountPaid,
            paymentConfig
          );
        } catch {
          // fallback para valor base
          total += amountPaid;
          continue;
        }

        // Busca a opção correspondente ao método/parcelas
        const option = calc.available_methods.find(
          (opt) =>
            opt.method === method && (opt.installments || 1) === installments
        );
        if (!option) {
          // fallback para valor base
          total += amountPaid;
        } else {
          // Se repassa a taxa, soma o valor final (cliente pagou a taxa)
          // Se não repassa, soma o valor base (receita líquida)
          total += option.passthrough_fee
            ? option.final_value
            : option.base_value;
        }
      }
      return Math.round(total * 100) / 100;
    });

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
