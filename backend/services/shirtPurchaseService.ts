import { prisma, withPrismaRetry } from "@/lib/prisma";
import {
  appendHistory,
  lockRow,
  type ServiceFailure,
} from "@/backend/services/batchRegistrationService";
import {
  getShirtConfig,
  isShirtPurchaseOpen,
  resolveShirtOnlyValue,
  validateShirtSelection,
} from "@/backend/utils/shirtPricing";

const TX_OPTIONS = { maxWait: 5000, timeout: 15000 } as const;

const failure = (status: number, error: string): ServiceFailure => ({
  ok: false,
  status,
  error,
});

type RegistrationForShirt = {
  id: string;
  status: string;
  wantsShirt: boolean | null;
  batch: { price: number; priceWithShirt: number | null } | null;
  event: { price: number; shirtConfig: unknown };
};

/**
 * Estado da oferta de camisa exibido no comprovante. Só campos da própria
 * inscrição: sem dados de terceiros.
 */
export interface ShirtPurchaseView {
  /** Pode comprar agora (confirmada, sem camisa, camisa habilitada e no prazo). */
  available: boolean;
  /** Valor da camisa em reais (diferença do lote da inscrição). */
  price: number;
  sizes: string[];
  deadline: string | null;
  /** Existe pedido de camisa aguardando pagamento (continuar pagamento). */
  pending: { orderId: string; shirtSize: string | null } | null;
}

export async function getShirtPurchaseView(
  registration: RegistrationForShirt,
  now: Date = new Date()
): Promise<ShirtPurchaseView | null> {
  const shirt = getShirtConfig(registration.event);
  if (!shirt || registration.status !== "CONFIRMED" || registration.wantsShirt) {
    return null;
  }
  const price = resolveShirtOnlyValue(registration.event, registration.batch);
  const open = isShirtPurchaseOpen(registration.event, now) && price > 0;
  if (!open) return null;

  const pendingOrder = await withPrismaRetry(() =>
    prisma.order.findFirst({
      where: {
        type: "SHIRT_ONLY",
        status: "PENDING",
        targetRegistrationId: registration.id,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, paymentDetails: true },
    })
  );
  const pendingSize = (pendingOrder?.paymentDetails as {
    shirtSize?: unknown;
  } | null)?.shirtSize;

  return {
    available: true,
    price,
    sizes: shirt.sizes,
    deadline: shirt.purchaseDeadline ?? null,
    pending: pendingOrder
      ? {
          orderId: pendingOrder.id,
          shirtSize: typeof pendingSize === "string" ? pendingSize : null,
        }
      : null,
  };
}

export interface ShirtOrderReady {
  ok: true;
  order: { id: string; totalValue: number; totalCents: number };
  eventTitle: string;
  buyer: { name: string; email: string | null; phone: string | null };
  shirtSize: string;
  reused: boolean;
}

/**
 * Cria (ou reaproveita) o pedido SHIRT_ONLY da inscrição. Sob o lock do
 * evento: confere CPF, status, camisa já comprada, prazo e tamanho; um pedido
 * de camisa pendente é reaproveitado (nunca há dois abertos). O valor vem
 * sempre do recálculo do servidor.
 */
export async function createOrReuseShirtOrder(
  input: { registrationId: string; cpf: string; shirtSize: string },
  now: Date = new Date()
): Promise<ShirtOrderReady | ServiceFailure> {
  const found = await withPrismaRetry(() =>
    prisma.registration.findUnique({
      where: { id: input.registrationId },
      select: { id: true, cpf: true, eventId: true },
    })
  );
  if (!found) return failure(404, "Inscrição não encontrada");
  if (found.cpf !== input.cpf) {
    return failure(403, "CPF não corresponde a esta inscrição");
  }

  return withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockRow(tx, "events", found.eventId);

      const registration = await tx.registration.findUnique({
        where: { id: found.id },
        include: {
          batch: { select: { price: true, priceWithShirt: true } },
          event: {
            select: { title: true, price: true, shirtConfig: true },
          },
        },
      });
      if (!registration) return failure(404, "Inscrição não encontrada");

      if (!getShirtConfig(registration.event)) {
        return failure(400, "Este evento não oferece camisa");
      }
      if (registration.status !== "CONFIRMED") {
        return failure(
          409,
          "A camisa só pode ser comprada depois que a inscrição estiver confirmada"
        );
      }
      if (registration.wantsShirt) {
        return failure(409, "Esta inscrição já inclui a camisa");
      }
      if (!isShirtPurchaseOpen(registration.event, now)) {
        return failure(400, "O prazo para comprar a camisa já encerrou");
      }

      const selection = validateShirtSelection(registration.event, {
        wantsShirt: true,
        shirtSize: input.shirtSize,
      });
      if (!selection.ok || !selection.shirtSize) {
        return failure(422, selection.error ?? "Tamanho de camisa inválido");
      }

      const totalCents = Math.round(
        resolveShirtOnlyValue(
          { price: Number(registration.event.price), shirtConfig: registration.event.shirtConfig },
          registration.batch
        ) * 100
      );
      if (totalCents <= 0) {
        return failure(409, "Valor da camisa indisponível para esta inscrição");
      }

      const open = await tx.order.findFirst({
        where: {
          type: "SHIRT_ONLY",
          status: "PENDING",
          targetRegistrationId: registration.id,
        },
        orderBy: { createdAt: "desc" },
      });

      const paymentDetails = appendHistory(
        { ...(open?.paymentDetails as object | null), shirtSize: selection.shirtSize },
        {
          event: open ? "shirt_order_resumed" : "shirt_order_created",
          at: now.toISOString(),
          shirtSize: selection.shirtSize,
        }
      );
      const order = open
        ? await tx.order.update({
            where: { id: open.id },
            data: {
              totalValue: totalCents / 100,
              amountCents: totalCents,
              paymentDetails,
            },
          })
        : await tx.order.create({
            data: {
              eventId: registration.eventId,
              type: "SHIRT_ONLY",
              status: "PENDING",
              paymentMethod: "INFINITE_PAY",
              totalValue: totalCents / 100,
              amountCents: totalCents,
              targetRegistrationId: registration.id,
              paymentDetails,
            },
          });

      return {
        ok: true as const,
        order: { id: order.id, totalValue: totalCents / 100, totalCents },
        eventTitle: registration.event.title,
        buyer: {
          name: registration.name,
          email: registration.email,
          phone: registration.phone,
        },
        shirtSize: selection.shirtSize,
        reused: !!open,
      };
    }, TX_OPTIONS)
  );
}
