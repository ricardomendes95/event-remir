import { Prisma } from "@prisma/client";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { lockRow, type ServiceFailure } from "@/backend/services/batchRegistrationService";
import { countOccupiedSlots } from "@/backend/services/eventBatchService";
import { resolveBaseValue } from "@/backend/utils/shirtPricing";
import { toBrazilE164 } from "@/backend/utils/phone";
import type {
  AdminRefundAction,
} from "@/backend/schemas/refundSchemas";

type Tx = Prisma.TransactionClient;

const TX_OPTIONS = { maxWait: 5000, timeout: 15000 } as const;

const UNRESOLVED = ["OPEN", "IN_CONTACT"] as const;

const ADMIN_CANCEL_REASON = "Cancelamento feito pela organização";

function failure(status: number, error: string): ServiceFailure {
  return { ok: false, status, error };
}

async function lockRegistration(tx: Tx, id: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM registrations WHERE id = ${id} FOR UPDATE`;
}

function appendHistory(
  details: unknown,
  entry: Record<string, unknown>
): Prisma.InputJsonValue {
  const base =
    details && typeof details === "object" && !Array.isArray(details)
      ? (details as Record<string, unknown>)
      : {};
  const history = Array.isArray(base.history) ? base.history : [];
  return { ...base, history: [...history, entry] } as Prisma.InputJsonValue;
}

/** Registra no histórico do pedido (quando a inscrição pertence a um). */
async function appendOrderHistory(
  tx: Tx,
  orderId: string | null,
  entry: Record<string, unknown>
): Promise<void> {
  if (!orderId) return;
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { paymentDetails: true },
  });
  if (!order) return;
  await tx.order.update({
    where: { id: orderId },
    data: {
      paymentDetails: appendHistory(order.paymentDetails, {
        ...entry,
        at: new Date().toISOString(),
      }),
    },
  });
}

// ---------------------------------------------------------------------------
// Participante (rotas públicas)
// ---------------------------------------------------------------------------

/**
 * Resposta pública igual para "não existe" e "CPF não confere": a rota pública
 * não pode revelar se uma inscrição existe.
 */
const NOT_FOUND_PUBLIC = "Não encontramos uma inscrição com estes dados";

export type ParticipantRefundView = {
  status: "OPEN" | "IN_CONTACT" | "RESOLVED";
  resolution: "REFUNDED" | "DENIED" | "WITHDRAWN" | "CANCELLED_NO_REFUND" | null;
  createdAt: string;
} | null;

/** Visão mínima (sem motivo, notas ou valores) da solicitação mais recente. */
export async function getParticipantRefundView(
  registrationId: string
): Promise<ParticipantRefundView> {
  const latest = await withPrismaRetry(() =>
    prisma.refundRequest.findFirst({
      where: { registrationId, origin: "PARTICIPANT" },
      orderBy: { createdAt: "desc" },
      select: { status: true, resolution: true, createdAt: true },
    })
  );
  if (!latest) return null;
  return {
    status: latest.status,
    resolution: latest.resolution,
    createdAt: latest.createdAt.toISOString(),
  };
}

export async function createParticipantRequest(
  registrationId: string,
  cpf: string,
  reason: string
): Promise<{ ok: true } | ServiceFailure> {
  return withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      const registration = await tx.registration.findUnique({
        where: { id: registrationId },
        select: { id: true, cpf: true, status: true },
      });
      if (!registration || registration.cpf !== cpf) {
        return failure(404, NOT_FOUND_PUBLIC);
      }

      await lockRegistration(tx, registrationId);

      if (registration.status !== "CONFIRMED") {
        return failure(
          400,
          "Só é possível pedir cancelamento de uma inscrição confirmada"
        );
      }

      const open = await tx.refundRequest.findFirst({
        where: { registrationId, status: { in: [...UNRESOLVED] } },
        select: { id: true },
      });
      if (open) {
        return failure(
          409,
          "Já recebemos sua solicitação. Entraremos em contato."
        );
      }

      await tx.refundRequest.create({
        data: { registrationId, reason, origin: "PARTICIPANT" },
      });
      return { ok: true as const };
    }, TX_OPTIONS)
  );
}

export async function withdrawParticipantRequest(
  registrationId: string,
  cpf: string
): Promise<{ ok: true } | ServiceFailure> {
  return withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      const registration = await tx.registration.findUnique({
        where: { id: registrationId },
        select: { id: true, cpf: true, status: true },
      });
      if (!registration || registration.cpf !== cpf) {
        return failure(404, NOT_FOUND_PUBLIC);
      }

      await lockRegistration(tx, registrationId);

      const open = await tx.refundRequest.findFirst({
        where: {
          registrationId,
          origin: "PARTICIPANT",
          status: { in: [...UNRESOLVED] },
        },
        select: { id: true },
      });
      if (!open) return failure(404, "Não há solicitação em andamento");

      if (registration.status !== "CONFIRMED") {
        return failure(
          409,
          "Sua inscrição já foi cancelada pela organização. Fale com a organização para reativá-la."
        );
      }

      await tx.refundRequest.update({
        where: { id: open.id },
        data: {
          status: "RESOLVED",
          resolution: "WITHDRAWN",
          resolvedAt: new Date(),
        },
      });
      return { ok: true as const };
    }, TX_OPTIONS)
  );
}

// ---------------------------------------------------------------------------
// Integração com o cancelamento direto pelo admin (Q7)
// ---------------------------------------------------------------------------

/**
 * Cancelamento direto pelo admin vira registro de histórico (origem ADMIN).
 * Inscrição gratuita não tem o que devolver: já nasce resolvida. As demais
 * ficam pendentes para a organização registrar o estorno ou encerrar sem ele.
 * Não duplica quando já existe solicitação em andamento.
 */
export async function recordAdminCancellation(
  tx: Tx,
  registration: { id: string; paymentMethod: string; orderId: string | null },
  adminId: string | null
): Promise<void> {
  const open = await tx.refundRequest.findFirst({
    where: { registrationId: registration.id, status: { in: [...UNRESOLVED] } },
    select: { id: true },
  });
  if (!open) {
    const noMoney = registration.paymentMethod === "FREE";
    await tx.refundRequest.create({
      data: {
        registrationId: registration.id,
        reason: ADMIN_CANCEL_REASON,
        origin: "ADMIN",
        ...(noMoney
          ? {
              status: "RESOLVED",
              resolution: "CANCELLED_NO_REFUND",
              resolvedById: adminId,
              resolvedAt: new Date(),
            }
          : {}),
      },
    });
  }
  await appendOrderHistory(tx, registration.orderId, {
    event: "registration_cancelled",
    registrationId: registration.id,
    by: adminId,
  });
}

/** Reativação direta: encerra solicitações em andamento como desistência. */
export async function closeRequestsOnReactivation(
  tx: Tx,
  registration: { id: string; orderId: string | null },
  adminId: string | null
): Promise<void> {
  await tx.refundRequest.updateMany({
    where: { registrationId: registration.id, status: { in: [...UNRESOLVED] } },
    data: {
      status: "RESOLVED",
      resolution: "WITHDRAWN",
      resolvedById: adminId,
      resolvedAt: new Date(),
      adminNotes: "Inscrição reativada pela organização",
    },
  });
  await appendOrderHistory(tx, registration.orderId, {
    event: "registration_reactivated",
    registrationId: registration.id,
    by: adminId,
  });
}

/** Vaga disponível no evento (e no lote, se houver quota) — chamar sob lock do evento. */
export async function hasRoomToReactivate(
  tx: Tx,
  registration: { id: string; eventId: string; batchId: string | null }
): Promise<boolean> {
  const event = await tx.event.findUnique({
    where: { id: registration.eventId },
    select: { maxParticipants: true },
  });
  if (!event) return false;
  const occupied = await countOccupiedSlots(tx, registration.eventId, registration.id);
  if (occupied >= event.maxParticipants) return false;
  if (registration.batchId) {
    const batch = await tx.eventBatch.findUnique({
      where: { id: registration.batchId },
      select: { quota: true },
    });
    if (batch?.quota != null) {
      const inBatch = await tx.registration.count({
        where: {
          batchId: registration.batchId,
          id: { not: registration.id },
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      });
      if (inBatch >= batch.quota) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

const adminInclude = {
  registration: {
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      paymentMethod: true,
      wantsShirt: true,
      orderId: true,
      batch: { select: { price: true, priceWithShirt: true } },
      event: {
        select: { id: true, title: true, price: true, shirtConfig: true },
      },
      order: { select: { _count: { select: { registrations: true } } } },
    },
  },
} satisfies Prisma.RefundRequestInclude;

type RequestWithRegistration = Prisma.RefundRequestGetPayload<{
  include: typeof adminInclude;
}>;

function paidAmountOf(r: RequestWithRegistration["registration"]): number {
  if (r.paymentMethod === "FREE") return 0;
  return resolveBaseValue(
    { price: Number(r.event.price), shirtConfig: r.event.shirtConfig },
    r.wantsShirt ?? false,
    r.batch
  );
}

function serializeForAdmin(
  req: RequestWithRegistration,
  adminNames: Map<string, string>
) {
  const r = req.registration;
  return {
    id: req.id,
    status: req.status,
    resolution: req.resolution,
    origin: req.origin,
    reason: req.reason,
    adminNotes: req.adminNotes,
    refundedAmount: req.refundedAmount,
    refundedAt: req.refundedAt?.toISOString() ?? null,
    resolvedAt: req.resolvedAt?.toISOString() ?? null,
    resolvedByName: req.resolvedById
      ? (adminNames.get(req.resolvedById) ?? null)
      : null,
    createdAt: req.createdAt.toISOString(),
    paidAmount: paidAmountOf(r),
    registration: {
      id: r.id,
      name: r.name,
      status: r.status,
      paymentMethod: r.paymentMethod,
      phoneE164: toBrazilE164(r.phone) ?? null,
      groupSize: r.order?._count.registrations ?? null,
    },
    event: { id: r.event.id, title: r.event.title },
  };
}

export type AdminRefundRequestItem = ReturnType<typeof serializeForAdmin>;

async function adminNamesFor(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((i): i is string => !!i))];
  if (unique.length === 0) return new Map<string, string>();
  const admins = await withPrismaRetry(() =>
    prisma.admin.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    })
  );
  return new Map(admins.map((a) => [a.id, a.name]));
}

export async function listRefundRequests(query: {
  status: "ACTIVE" | "OPEN" | "IN_CONTACT" | "RESOLVED" | "ALL";
  eventId?: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.RefundRequestWhereInput = {
    ...(query.status === "ACTIVE"
      ? { status: { in: [...UNRESOLVED] } }
      : query.status === "ALL"
        ? {}
        : { status: query.status }),
    ...(query.eventId ? { registration: { eventId: query.eventId } } : {}),
  };

  const [items, total, activeCount] = await withPrismaRetry(() =>
    Promise.all([
      prisma.refundRequest.findMany({
        where,
        include: adminInclude,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.refundRequest.count({ where }),
      prisma.refundRequest.count({ where: { status: { in: [...UNRESOLVED] } } }),
    ])
  );
  const names = await adminNamesFor(items.map((i) => i.resolvedById));
  return {
    items: items.map((i) => serializeForAdmin(i, names)),
    total,
    activeCount,
  };
}

export async function applyAdminAction(
  id: string,
  adminId: string,
  input: AdminRefundAction
): Promise<{ ok: true; item: AdminRefundRequestItem } | ServiceFailure> {
  const outcome = await withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      const found = await tx.refundRequest.findUnique({
        where: { id },
        select: { registrationId: true },
      });
      if (!found) return failure(404, "Solicitação não encontrada");

      const regInfo = await tx.registration.findUnique({
        where: { id: found.registrationId },
        select: { eventId: true },
      });
      // Reativação disputa vaga: trava o evento como nas demais inscrições.
      if (input.action === "reactivate" && regInfo) {
        await lockRow(tx, "events", regInfo.eventId);
      }
      await lockRegistration(tx, found.registrationId);

      const request = await tx.refundRequest.findUnique({
        where: { id },
        include: adminInclude,
      });
      if (!request) return failure(404, "Solicitação não encontrada");
      const reg = request.registration;
      const unresolved = request.status !== "RESOLVED";
      const now = new Date();
      const resolvedBase = {
        status: "RESOLVED" as const,
        resolvedById: adminId,
        resolvedAt: now,
        ...(input.adminNotes ? { adminNotes: input.adminNotes } : {}),
      };

      switch (input.action) {
        case "mark_contact": {
          if (request.status !== "OPEN") {
            return failure(409, "Esta solicitação não está aguardando contato");
          }
          await tx.refundRequest.update({
            where: { id },
            data: {
              status: "IN_CONTACT",
              ...(input.adminNotes ? { adminNotes: input.adminNotes } : {}),
            },
          });
          break;
        }

        case "deny": {
          if (!unresolved) return failure(409, "Esta solicitação já foi encerrada");
          if (request.origin !== "PARTICIPANT" || reg.status === "CANCELLED") {
            return failure(
              409,
              "Só é possível negar um pedido do participante cuja inscrição ainda está ativa"
            );
          }
          await tx.refundRequest.update({
            where: { id },
            data: { ...resolvedBase, resolution: "DENIED" },
          });
          break;
        }

        case "register_refund": {
          if (!unresolved) return failure(409, "Esta solicitação já foi encerrada");
          const paid = paidAmountOf(reg);
          if (paid <= 0) {
            return failure(
              422,
              "Esta inscrição não tem valor pago. Use \"Cancelar sem estorno\"."
            );
          }
          if (input.refundedAmount > paid + 0.001) {
            return failure(
              422,
              "O valor estornado não pode ser maior que o valor pago pela inscrição"
            );
          }
          if (reg.status !== "CANCELLED") {
            await tx.registration.update({
              where: { id: reg.id },
              data: { status: "CANCELLED" },
            });
          }
          await tx.refundRequest.update({
            where: { id },
            data: {
              ...resolvedBase,
              resolution: "REFUNDED",
              refundedAmount: input.refundedAmount,
              refundedAt: input.refundedAt ? new Date(input.refundedAt) : now,
            },
          });
          await appendOrderHistory(tx, reg.orderId, {
            event: "refund_registered",
            registrationId: reg.id,
            refundedAmount: input.refundedAmount,
            by: adminId,
          });
          break;
        }

        case "cancel_without_refund": {
          if (!unresolved) return failure(409, "Esta solicitação já foi encerrada");
          if (reg.status !== "CANCELLED") {
            await tx.registration.update({
              where: { id: reg.id },
              data: { status: "CANCELLED" },
            });
            await appendOrderHistory(tx, reg.orderId, {
              event: "registration_cancelled",
              registrationId: reg.id,
              by: adminId,
            });
          }
          await tx.refundRequest.update({
            where: { id },
            data: { ...resolvedBase, resolution: "CANCELLED_NO_REFUND" },
          });
          break;
        }

        case "reactivate": {
          if (request.resolution === "REFUNDED") {
            return failure(
              409,
              "O valor desta inscrição já foi estornado. O participante precisa pagar novamente pelo CPF."
            );
          }
          if (reg.status !== "CANCELLED") {
            return failure(409, "Esta inscrição não está cancelada");
          }
          const full = await tx.registration.findUnique({
            where: { id: reg.id },
            select: { id: true, eventId: true, batchId: true },
          });
          if (!full || !(await hasRoomToReactivate(tx, full))) {
            return failure(
              409,
              "Não há vagas disponíveis para reativar esta inscrição"
            );
          }
          await tx.registration.update({
            where: { id: reg.id },
            data: { status: "CONFIRMED" },
          });
          await tx.refundRequest.update({
            where: { id },
            data: { ...resolvedBase, resolution: "WITHDRAWN" },
          });
          await appendOrderHistory(tx, reg.orderId, {
            event: "registration_reactivated",
            registrationId: reg.id,
            by: adminId,
          });
          break;
        }

        case "reopen": {
          if (
            request.status !== "RESOLVED" ||
            (request.resolution !== "DENIED" && request.resolution !== "WITHDRAWN")
          ) {
            return failure(409, "Só é possível reabrir pedidos negados ou desistidos");
          }
          if (reg.status === "CANCELLED") {
            return failure(409, "A inscrição já está cancelada");
          }
          const open = await tx.refundRequest.findFirst({
            where: {
              registrationId: reg.id,
              status: { in: [...UNRESOLVED] },
            },
            select: { id: true },
          });
          if (open) return failure(409, "Já existe uma solicitação em andamento");
          await tx.refundRequest.update({
            where: { id },
            data: {
              status: "OPEN",
              resolution: null,
              resolvedById: null,
              resolvedAt: null,
              ...(input.adminNotes ? { adminNotes: input.adminNotes } : {}),
            },
          });
          break;
        }
      }

      const updated = await tx.refundRequest.findUnique({
        where: { id },
        include: adminInclude,
      });
      return { ok: true as const, updated: updated as RequestWithRegistration };
    }, TX_OPTIONS)
  );

  if (!outcome.ok) return outcome;
  const names = await adminNamesFor([outcome.updated.resolvedById]);
  return { ok: true, item: serializeForAdmin(outcome.updated, names) };
}
