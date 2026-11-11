import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { validateShirtSelection } from "@/backend/utils/shirtPricing";
import {
  AdminRegistrationUpdateSchema,
  manualPaymentIssues,
} from "@/backend/schemas/registrationSchemas";
import {
  validationErrorResponse,
  zodErrorResponse,
} from "@/backend/utils/validationResponse";
import { sanitizeRegistrationForRole } from "@/backend/utils/registrationSerializer";
import { canViewFinancialValues } from "@/lib/permissions";
import { withPaymentDate } from "@/backend/utils/paymentDate";
import { lockRow } from "@/backend/services/batchRegistrationService";
import {
  closeRequestsOnReactivation,
  hasRoomToReactivate,
  recordAdminCancellation,
} from "@/backend/services/refundService";

interface Params {
  id: string;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const params = await context.params;
    const registration = await withPrismaRetry(() =>
      prisma.registration.findUnique({
        where: { id: params.id },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              price: true,
              startDate: true,
            },
          },
        },
      })
    );

    if (!registration) {
      return NextResponse.json(
        { success: false, error: "Inscrição não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      // CHECKIN/SUPPORT não veem valores financeiros (ADR-002)
      data: sanitizeRegistrationForRole(
        withPaymentDate(registration),
        request.headers.get("x-user-role")
      ),
    });
  } catch (error) {
    console.error("Erro ao buscar inscrição:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const params = await context.params;
    const body = await request.json();
    const parsed = AdminRegistrationUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const {
      name,
      email,
      cpf,
      phone,
      status,
      paymentMethod,
      dynamicFormData,
      wantsShirt,
      shirtSize,
      notes,
      manualPaymentType,
      cashResponsible,
    } = parsed.data;

    // Verificar se a inscrição existe (com o shirtConfig do evento p/ validação)
    const existingRegistration = await withPrismaRetry(() =>
      prisma.registration.findUnique({
        where: { id: params.id },
        include: { event: { select: { shirtConfig: true } } },
      })
    );

    if (!existingRegistration) {
      return NextResponse.json(
        { success: false, error: "Inscrição não encontrada" },
        { status: 404 }
      );
    }

    // Combina o enviado com o salvo para validar o estado final do pagamento manual.
    const effectivePaymentMethod =
      paymentMethod ?? existingRegistration.paymentMethod;
    const paymentMethodChanged =
      paymentMethod !== undefined &&
      paymentMethod !== existingRegistration.paymentMethod;
    let effectiveType =
      manualPaymentType !== undefined
        ? manualPaymentType
        : existingRegistration.manualPaymentType;
    let effectiveResponsible =
      cashResponsible !== undefined
        ? cashResponsible
        : existingRegistration.cashResponsible;

    // Ao sair de Manual, ou trocar o método para algo que não é Dinheiro,
    // os detalhes antigos deixam de valer e são limpos.
    if (paymentMethodChanged && effectivePaymentMethod !== "MANUAL") {
      if (manualPaymentType === undefined) effectiveType = null;
    }
    if (effectiveType !== "CASH" && cashResponsible === undefined) {
      effectiveResponsible = null;
    }

    // Só valida quando o envio toca no pagamento: trocar o status de uma manual
    // legada (sem sub-método) não pode ser bloqueado.
    const touchesPayment =
      paymentMethod !== undefined ||
      manualPaymentType !== undefined ||
      cashResponsible !== undefined;
    const manualIssues = touchesPayment
      ? manualPaymentIssues({
          paymentMethod: effectivePaymentMethod,
          manualPaymentType: effectiveType,
          cashResponsible: effectiveResponsible,
        })
      : [];
    if (manualIssues.length > 0) {
      return validationErrorResponse(manualIssues);
    }

    // Validar seleção de camisa quando enviada
    const shirtProvided = wantsShirt !== undefined;
    const shirtSelection = shirtProvided
      ? validateShirtSelection(existingRegistration.event, {
          wantsShirt,
          shirtSize,
        })
      : null;
    if (shirtSelection && !shirtSelection.ok) {
      return NextResponse.json(
        {
          success: false,
          error: shirtSelection.error || "Seleção de camisa inválida",
        },
        { status: 422 }
      );
    }

    // Cancelar ou reativar mexe em dinheiro/vaga: só ADMIN e SUPER_ADMIN
    // (req. 12, ADR-003 Q9).
    const wasCancelled = existingRegistration.status === "CANCELLED";
    const cancelling = status === "CANCELLED" && !wasCancelled;
    const reactivating =
      wasCancelled && status !== undefined && status !== "CANCELLED";
    const adminId = request.headers.get("x-user-id");
    if (
      (cancelling || reactivating) &&
      !canViewFinancialValues(request.headers.get("x-user-role"))
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Acesso negado - apenas Admin e Super Admin cancelam ou reativam inscrições",
        },
        { status: 403 }
      );
    }

    // Atualizar inscrição (cancelamento/reativação e histórico de estorno na
    // mesma transação)
    const outcome = await withPrismaRetry(() =>
      prisma.$transaction(async (tx) => {
        if (reactivating) {
          await lockRow(tx, "events", existingRegistration.eventId);
          if (
            status !== "PAYMENT_FAILED" &&
            !(await hasRoomToReactivate(tx, existingRegistration))
          ) {
            return { roomFull: true as const };
          }
        }

        const updated = await tx.registration.update({
          where: { id: params.id },
          data: {
            ...(name && { name }),
            ...(email !== undefined && { email: email || null }),
            ...(cpf && { cpf: cpf.replace(/\D/g, "") }),
            ...(phone !== undefined && {
              phone: phone ? phone.replace(/\D/g, "") : null,
            }),
            ...(status && { status }),
            ...(paymentMethod && { paymentMethod }),
            ...(dynamicFormData !== undefined && {
              dynamicFormData: (dynamicFormData ??
                Prisma.JsonNull) as Prisma.InputJsonValue,
            }),
            ...(notes !== undefined && { notes: notes ?? null }),
            manualPaymentType: effectiveType ?? null,
            cashResponsible: effectiveResponsible ?? null,
            ...(shirtSelection
              ? {
                  wantsShirt: shirtSelection.wantsShirt,
                  shirtSize: shirtSelection.shirtSize,
                }
              : {}),
          },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                price: true,
                startDate: true,
              },
            },
          },
        });

        // Só cancelamento de inscrição confirmada gera histórico de estorno.
        if (cancelling && existingRegistration.status === "CONFIRMED") {
          await recordAdminCancellation(tx, updated, adminId);
        } else if (reactivating) {
          await closeRequestsOnReactivation(tx, updated, adminId);
        }
        return { roomFull: false as const, updated };
      }, { maxWait: 5000, timeout: 15000 })
    );

    if (outcome.roomFull) {
      return NextResponse.json(
        {
          success: false,
          error: "Não há vagas disponíveis para reativar esta inscrição",
        },
        { status: 409 }
      );
    }
    const updatedRegistration = outcome.updated;

    return NextResponse.json({
      success: true,
      data: sanitizeRegistrationForRole(
        updatedRegistration,
        request.headers.get("x-user-role")
      ),
      message: "Inscrição atualizada com sucesso",
    });
  } catch (error) {
    console.error("Erro ao atualizar inscrição:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const params = await context.params;
    // Verificar se a inscrição existe
    const existingRegistration = await withPrismaRetry(() =>
      prisma.registration.findUnique({ where: { id: params.id } })
    );

    if (!existingRegistration) {
      return NextResponse.json(
        { success: false, error: "Inscrição não encontrada" },
        { status: 404 }
      );
    }

    // Excluir inscrição
    await withPrismaRetry(() =>
      prisma.registration.delete({ where: { id: params.id } })
    );

    return NextResponse.json({
      success: true,
      message: "Inscrição excluída com sucesso",
    });
  } catch (error) {
    console.error("Erro ao excluir inscrição:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
