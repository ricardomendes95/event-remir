import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { canViewRegistrationNotes } from "@/lib/permissions";
import { resolveBaseValue } from "@/backend/utils/shirtPricing";
import type { DynamicField } from "@/backend/schemas/dynamicFormSchemas";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const status = searchParams.get("status") ?? "ALL";
    const canSeeNotes = canViewRegistrationNotes(
      request.headers.get("x-user-role")
    );

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: "ID do evento é obrigatório" },
        { status: 400 }
      );
    }

    const event = await withPrismaRetry(() =>
      prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          startDate: true,
          endDate: true,
          location: true,
          isFree: true,
          dynamicFormFields: true,
          shirtConfig: true,
        },
      })
    );

    if (!event) {
      return NextResponse.json(
        { success: false, error: "Evento não encontrado" },
        { status: 404 }
      );
    }

    const where = {
      eventId,
      ...(status !== "ALL"
        ? { status: status as "PENDING" | "CONFIRMED" | "CANCELLED" | "PAYMENT_FAILED" }
        : {}),
    };

    const registrations = await withPrismaRetry(() =>
      prisma.registration.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          cpf: true,
          phone: true,
          status: true,
          paymentMethod: true,
          manualPaymentType: true,
          cashResponsible: true,
          notes: true,
          createdAt: true,
          checkedInAt: true,
          dynamicFormData: true,
          wantsShirt: true,
          shirtSize: true,
          batch: { select: { price: true, priceWithShirt: true } },
        },
        orderBy: { name: "asc" },
      })
    );

    const byStatus = registrations.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const confirmed = byStatus["CONFIRMED"] ?? 0;


    // Configuração de camisa do evento
    const shirtCfg = event.shirtConfig as
      | { enabled: boolean; priceWithShirt: number; sizes: string[] }
      | null;

    // Receita estimada: soma por inscrição confirmada (com/sem camisa)
    const totalRevenue = registrations
      .filter((r) => r.status === "CONFIRMED")
      .reduce(
        (sum, r) =>
          sum +
          resolveBaseValue(
            { price: Number(event.price), shirtConfig: event.shirtConfig },
            r.wantsShirt ?? false,
            r.batch
          ),
        0
      );

    // Estatísticas de camisa (entre todas as inscrições retornadas)
    const withShirt = registrations.filter((r) => r.wantsShirt).length;
    const sizeBreakdown: Record<string, number> = {};
    for (const r of registrations) {
      if (r.wantsShirt && r.shirtSize) {
        sizeBreakdown[r.shirtSize] = (sizeBreakdown[r.shirtSize] ?? 0) + 1;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        event: {
          id: event.id,
          title: event.title,
          description: event.description,
          price: Number(event.price),
          isFree: event.isFree,
          startDate: event.startDate.toISOString(),
          endDate: event.endDate?.toISOString(),
          location: event.location,
          dynamicFormFields: (event.dynamicFormFields as DynamicField[]) ?? [],
          shirtConfig: shirtCfg,
        },
        registrations: registrations.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          cpf: r.cpf,
          phone: r.phone,
          status: r.status,
          paymentMethod: r.paymentMethod,
          manualPaymentType: r.manualPaymentType ?? null,
          // CHECKIN não vê observação nem responsável (defensivo: a rota
          // hoje só admite ADMIN/SUPER_ADMIN)
          cashResponsible: canSeeNotes ? r.cashResponsible : null,
          notes: canSeeNotes ? r.notes : null,
          createdAt: r.createdAt.toISOString(),
          checkedInAt: r.checkedInAt?.toISOString() ?? null,
          dynamicFormData: (r.dynamicFormData as Record<string, unknown>) ?? {},
          wantsShirt: r.wantsShirt ?? false,
          shirtSize: r.shirtSize ?? null,
        })),
        stats: {
          total: registrations.length,
          confirmed,
          pending: byStatus["PENDING"] ?? 0,
          cancelled: byStatus["CANCELLED"] ?? 0,
          paymentFailed: byStatus["PAYMENT_FAILED"] ?? 0,
          totalRevenue,
          withShirt,
          withoutShirt: registrations.length - withShirt,
          sizeBreakdown,
        },
        exportedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Erro ao exportar inscrições (admin):", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
