import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import type { DynamicField } from "@/backend/schemas/dynamicFormSchemas";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const status = searchParams.get("status") ?? "ALL";

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
          createdAt: true,
          checkedInAt: true,
          dynamicFormData: true,
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
    const totalRevenue = confirmed * Number(event.price);

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
        },
        registrations: registrations.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          cpf: r.cpf,
          phone: r.phone,
          status: r.status,
          paymentMethod: r.paymentMethod,
          createdAt: r.createdAt.toISOString(),
          checkedInAt: r.checkedInAt?.toISOString() ?? null,
          dynamicFormData: (r.dynamicFormData as Record<string, unknown>) ?? {},
        })),
        stats: {
          total: registrations.length,
          confirmed,
          pending: byStatus["PENDING"] ?? 0,
          cancelled: byStatus["CANCELLED"] ?? 0,
          paymentFailed: byStatus["PAYMENT_FAILED"] ?? 0,
          totalRevenue,
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
