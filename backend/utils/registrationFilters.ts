import type { Prisma } from "@prisma/client";

const PAYMENT_METHODS = ["INFINITE_PAY", "MANUAL", "FREE", "MERCADO_PAGO"] as const;
const STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "PAYMENT_FAILED"] as const;

/**
 * Filtros da tela de inscrições, compartilhados entre listagem e estatísticas
 * (as estatísticas ignoram a busca textual).
 * Parâmetros: status, eventId, batchId ("NONE" = sem lote), paymentMethod,
 * group ("GROUP" = compra em grupo, "SINGLE" = individual), search.
 */
export function buildRegistrationWhere(
  searchParams: URLSearchParams,
  options: { includeSearch: boolean }
): Prisma.RegistrationWhereInput {
  const where: Prisma.RegistrationWhereInput = {};

  const status = searchParams.get("status");
  if (status && (STATUSES as readonly string[]).includes(status)) {
    where.status = status as (typeof STATUSES)[number];
  }

  const eventId = searchParams.get("eventId");
  if (eventId && eventId !== "ALL") where.eventId = eventId;

  const batchId = searchParams.get("batchId");
  if (batchId && batchId !== "ALL") {
    where.batchId = batchId === "NONE" ? null : batchId;
  }

  const paymentMethod = searchParams.get("paymentMethod");
  if (paymentMethod && (PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) {
    where.paymentMethod = paymentMethod as (typeof PAYMENT_METHODS)[number];
  }

  const group = searchParams.get("group");
  if (group === "GROUP") where.orderId = { not: null };
  if (group === "SINGLE") where.orderId = null;

  const search = searchParams.get("search");
  if (options.includeSearch && search) {
    const conditions: Prisma.RegistrationWhereInput[] = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { event: { title: { contains: search, mode: "insensitive" } } },
    ];
    const cleanCpf = search.replace(/\D/g, "");
    if (cleanCpf) conditions.push({ cpf: { contains: cleanCpf } });
    where.OR = conditions;
  }

  return where;
}
