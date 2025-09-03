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

    // Calcular receita total e receita não-manual usando helper de retry
    const [totalRevenue, nonManualRevenue] = await withPrismaRetry(async () => {
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
          paymentMethod: true,
        },
      });

      let total = 0;
      let nonManualTotal = 0;

      for (const reg of confirmedRegistrations) {
        // Valor base do evento
        const baseValue = reg.event.price;
        let finalRevenue = baseValue; // Valor que será somado à receita

        // Se não é inscrição manual, calcular com desconto das taxas
        if (reg.paymentMethod !== "MANUAL") {
          // Extrair informações do pagamento
          let paymentMethod = "pix"; // padrão
          let installments = 1;

          if (reg.paymentDetails) {
            try {
              const details =
                typeof reg.paymentDetails === "string"
                  ? JSON.parse(reg.paymentDetails)
                  : reg.paymentDetails;

              // Mapear método do MercadoPago para nosso formato
              if (details.paymentMethod) {
                const mpMethod = details.paymentMethod.toLowerCase();
                if (mpMethod === "pix") {
                  paymentMethod = "pix";
                } else if (
                  mpMethod === "master" ||
                  mpMethod === "visa" ||
                  mpMethod === "credit_card"
                ) {
                  paymentMethod = "credit_card";
                } else if (mpMethod === "debit_card") {
                  paymentMethod = "debit_card";
                }
              }

              if (details.installments) {
                installments = parseInt(details.installments) || 1;
              }
            } catch (error) {
              console.warn("Erro ao processar paymentDetails:", error);
            }
          }

          // Obter configuração de pagamento do evento
          let paymentConfig: PaymentConfig | undefined;
          if (reg.event.paymentConfig) {
            try {
              paymentConfig =
                typeof reg.event.paymentConfig === "string"
                  ? JSON.parse(reg.event.paymentConfig)
                  : (reg.event.paymentConfig as PaymentConfig);
            } catch (error) {
              console.warn("Erro ao processar paymentConfig:", error);
            }
          }

          // Calcular valor líquido (com desconto das taxas se o evento não repassa)
          try {
            const calc = PaymentFeeCalculator.calculatePaymentOptions(
              baseValue,
              paymentConfig
            );

            const option = calc.available_methods.find(
              (opt) =>
                opt.method === paymentMethod &&
                (opt.installments || 1) === installments
            );

            if (option) {
              // Se o evento não repassa a taxa (passthrough_fee = false),
              // a receita líquida é o valor base menos a taxa que foi descontada
              if (!option.passthrough_fee) {
                // Receita = valor base - taxa do MercadoPago
                finalRevenue = baseValue - baseValue * option.fee_percentage;
              } else {
                // Se repassa a taxa, a receita é o valor base (cliente pagou a taxa)
                finalRevenue = baseValue;
              }
            }
          } catch (error) {
            console.warn("Erro ao calcular taxas de pagamento:", error);
            // Fallback para valor base
            finalRevenue = baseValue;
          }
        }
        // Para inscrições manuais, usar valor base sem desconto

        total += finalRevenue;

        // Se não é manual, somar ao total não-manual
        if (reg.paymentMethod !== "MANUAL") {
          nonManualTotal += finalRevenue;
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
