import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { resolveBaseValue } from "@/backend/utils/shirtPricing";
import { getParticipantRefundView } from "@/backend/services/refundService";
import {
  isOrderNsu,
  parseOrderNsu,
} from "@/backend/services/payment/infinitePayService";

const searchSchema = z
  .object({
    registrationId: z.string().optional().nullable(),
    paymentId: z.string().optional().nullable(),
  })
  .refine((data) => data.registrationId || data.paymentId, {
    message: "É necessário fornecer registrationId ou paymentId",
  });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { registrationId, paymentId } = searchSchema.parse(body);

    // order_nsu de compra em lote ("ord_<id>", vindo do retorno do checkout):
    // resolve para o responsável pela compra (1ª inscrição do pedido).
    const orderRef = [registrationId, paymentId].find(
      (v): v is string => !!v && isOrderNsu(v)
    );

    // Buscar inscrição por ID ou paymentId
    const registration = await prisma.registration.findFirst({
      where: orderRef
        ? { orderId: parseOrderNsu(orderRef) }
        : registrationId
          ? { id: registrationId }
          : { paymentId: paymentId },
      orderBy: orderRef
        ? [{ createdAt: "asc" }, { id: "asc" }]
        : undefined,
      include: {
        batch: { select: { price: true, priceWithShirt: true } },
        event: {
          select: {
            title: true,
            price: true,
            startDate: true,
            location: true,
            isFree: true,
            formMode: true,
            dynamicFormFields: true,
            shirtConfig: true,
          },
        },
      },
    });

    if (!registration) {
      return NextResponse.json(
        { error: "Inscrição não encontrada" },
        { status: 404 }
      );
    }

    // Valor efetivamente pago pela inscrição (com camisa, se escolhida)
    const amountPaid = resolveBaseValue(
      {
        price: Number(registration.event.price),
        shirtConfig: registration.event.shirtConfig,
      },
      registration.wantsShirt ?? false,
      registration.batch
    );

    const refundRequest = await getParticipantRefundView(registration.id);

    // Formatear resposta
    const response = {
      id: registration.id,
      name: registration.name,
      email: registration.email,
      cpf: registration.cpf,
      phone: registration.phone,
      status: registration.status,
      paymentId: registration.paymentId,
      paymentMethod: registration.paymentMethod,
      orderId: registration.orderId,
      dynamicFormData: registration.dynamicFormData,
      registrationDate: registration.createdAt.toISOString(),
      wantsShirt: registration.wantsShirt ?? false,
      shirtSize: registration.shirtSize ?? null,
      eventHasShirt: !!(
        registration.event.shirtConfig as { enabled?: boolean } | null
      )?.enabled,
      amountPaid,
      refundRequest,
      event: {
        title: registration.event.title,
        price: Number(registration.event.price),
        date: registration.event.startDate.toISOString(),
        location: registration.event.location,
        isFree: registration.event.isFree,
        formMode: registration.event.formMode,
        dynamicFormFields: registration.event.dynamicFormFields,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Erro ao buscar inscrição:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Parâmetros inválidos", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
