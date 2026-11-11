import { Prisma } from "@prisma/client";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { CsvParseError } from "@/backend/utils/csvParser";
import { parseStatement } from "./statementParser";
import { loadCandidates, type CandidateView } from "./candidates";
import { findUncovered, reconcile, type ReconcileEntry } from "./reconcile";

const DAY_MS = 24 * 60 * 60 * 1000;
// Brasília é UTC-3 o ano todo: o "dia" do extrato começa às 03:00 UTC.
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

const LINKED_STATUSES = ["MATCHED", "AMOUNT_MISMATCH", "RESOLVED_MANUAL"] as const;

export class AuditError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function dayBounds(start: Date, end: Date) {
  const startDay = Math.floor((start.getTime() - BRT_OFFSET_MS) / DAY_MS) * DAY_MS + BRT_OFFSET_MS;
  const endDay = Math.floor((end.getTime() - BRT_OFFSET_MS) / DAY_MS) * DAY_MS + BRT_OFFSET_MS + DAY_MS - 1;
  return { start: new Date(startDay), end: new Date(endDay) };
}

async function loadLinkedIds(): Promise<Set<string>> {
  const linked = await withPrismaRetry(() =>
    prisma.statementEntry.findMany({
      where: { matchStatus: { in: [...LINKED_STATUSES] } },
      select: { registrationId: true, orderId: true },
    })
  );
  const ids = new Set<string>();
  for (const e of linked) {
    if (e.registrationId) ids.add(`registration:${e.registrationId}`);
    if (e.orderId) ids.add(`order:${e.orderId}`);
  }
  return ids;
}

function candidateRef(c: CandidateView) {
  return c.kind === "ORDER"
    ? { orderId: c.orderId, registrationId: null }
    : { orderId: null, registrationId: c.registrationId };
}

export async function importStatement(params: {
  text: string;
  fileName: string;
  userId: string;
  userName: string | null;
}) {
  let parsed;
  try {
    parsed = parseStatement(params.text);
  } catch (error) {
    if (error instanceof CsvParseError) throw new AuditError(error.message, 422);
    throw error;
  }

  const existing = await withPrismaRetry(() =>
    prisma.statementEntry.findMany({
      where: { externalId: { in: parsed.rows.map((r) => r.externalId) } },
      select: { externalId: true },
    })
  );
  const known = new Set(existing.map((e) => e.externalId));
  const fresh = parsed.rows.filter((r) => !known.has(r.externalId));

  const period = dayBounds(parsed.periodStart, parsed.periodEnd);
  const candidates = await loadCandidates(period, await loadLinkedIds());
  const byId = new Map(candidates.map((c) => [c.id, c]));

  const reconcileInput: ReconcileEntry[] = fresh.map((r) => ({
    key: r.externalId,
    kind: r.kind,
    payerName: r.payerName,
    amountCents: r.amountCents,
    paidAt: r.paidAt,
  }));
  const { results } = reconcile(reconcileInput, candidates);
  const resultByKey = new Map(results.map((r) => [r.key, r]));

  const data: Prisma.StatementEntryCreateManyImportInput[] = parsed.rows.map((row) => {
    const base = {
      externalId: row.externalId,
      kind: row.kind,
      payerName: row.payerName || null,
      description: row.description,
      amountCents: row.amountCents,
      paidAt: row.paidAt,
      raw: row.raw as Prisma.InputJsonValue,
    };
    const result = resultByKey.get(row.externalId);
    if (!result) {
      return { ...base, matchStatus: "DUPLICATE", matchNote: "Linha já importada antes." };
    }
    const target = result.candidateId ? byId.get(result.candidateId) : undefined;
    const suggestions = result.suggestions
      .map((s) => {
        const c = byId.get(s.candidateId);
        return c
          ? {
              candidateId: c.id,
              score: s.score,
              label: c.label,
              eventTitle: c.eventTitle,
              amountCents: c.displayAmountCents,
            }
          : null;
      })
      .filter((s) => s !== null);
    return {
      ...base,
      matchStatus: result.status,
      matchNote: result.note,
      ...(target && result.status !== "DUPLICATE_PAYMENT" ? candidateRef(target) : {}),
      ...(suggestions.length ? { suggestions: suggestions as Prisma.InputJsonValue } : {}),
    };
  });

  const created = await withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      const record = await tx.statementImport.create({
        data: {
          fileName: params.fileName.slice(0, 200),
          importedById: params.userId,
          importedByName: params.userName,
          periodStart: parsed.periodStart,
          periodEnd: parsed.periodEnd,
          totalRows: parsed.rows.length,
        },
      });
      await tx.statementEntry.createMany({
        data: data.map((d) => ({ ...d, importId: record.id })),
      });
      return record;
    })
  );

  return { importId: created.id, ...(await getImportSummary(created.id)) };
}

export async function getImportSummary(importId: string) {
  const grouped = await withPrismaRetry(() =>
    prisma.statementEntry.groupBy({
      by: ["matchStatus"],
      where: { importId },
      _count: { _all: true },
    })
  );
  const counts: Record<string, number> = {};
  for (const g of grouped) counts[g.matchStatus] = g._count._all;
  return { counts };
}

export async function listImports() {
  const imports = await withPrismaRetry(() =>
    prisma.statementImport.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        fileName: true,
        importedByName: true,
        periodStart: true,
        periodEnd: true,
        totalRows: true,
        createdAt: true,
      },
    })
  );
  return imports;
}

export async function getImportDetail(importId: string) {
  const record = await withPrismaRetry(() =>
    prisma.statementImport.findUnique({ where: { id: importId } })
  );
  if (!record) throw new AuditError("Importação não encontrada", 404);

  const entries = await withPrismaRetry(() =>
    prisma.statementEntry.findMany({
      where: { importId },
      orderBy: { paidAt: "asc" },
      select: {
        id: true,
        kind: true,
        payerName: true,
        description: true,
        amountCents: true,
        paidAt: true,
        matchStatus: true,
        matchNote: true,
        registrationId: true,
        orderId: true,
        suggestions: true,
      },
    })
  );
  const { counts } = await getImportSummary(importId);

  let uncovered: CandidateView[] = [];
  let linkOptions: CandidateView[] = [];
  if (record.periodStart && record.periodEnd) {
    const period = dayBounds(record.periodStart, record.periodEnd);
    const linkedIds = await loadLinkedIds();
    const candidates = await loadCandidates(period, linkedIds);
    uncovered = findUncovered(candidates, linkedIds, period) as CandidateView[];
    linkOptions = candidates.filter((c) => !linkedIds.has(c.id));
  }

  const view = (c: CandidateView) => ({
    id: c.id,
    label: c.label,
    eventTitle: c.eventTitle,
    amountCents: c.displayAmountCents,
    paidAt: c.paidAt,
    probableCard: c.channel === "CREDIT",
    checkable: c.checkable,
    registrationId: c.registrationId,
    orderId: c.orderId,
  });

  return {
    import: {
      id: record.id,
      fileName: record.fileName,
      importedByName: record.importedByName,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      totalRows: record.totalRows,
      createdAt: record.createdAt,
    },
    counts,
    entries,
    uncovered: uncovered.map(view),
    linkOptions: linkOptions.map(view),
  };
}

export type EntryAction =
  | { action: "link"; registrationId?: string; orderId?: string }
  | { action: "ignore" }
  | { action: "unlink" };

export async function applyEntryAction(
  entryId: string,
  input: EntryAction,
  user: { name: string | null }
) {
  const entry = await withPrismaRetry(() =>
    prisma.statementEntry.findUnique({ where: { id: entryId } })
  );
  if (!entry) throw new AuditError("Linha do extrato não encontrada", 404);
  const who = user.name ?? "administrador";

  if (input.action === "unlink") {
    return withPrismaRetry(() =>
      prisma.statementEntry.update({
        where: { id: entryId },
        data: {
          matchStatus: "UNMATCHED",
          registrationId: null,
          orderId: null,
          matchNote: `Vínculo desfeito por ${who}.`,
        },
      })
    );
  }

  if (entry.kind !== "PIX_RECEIVED") {
    throw new AuditError("Só recebimentos por Pix podem ser vinculados ou marcados como externos.");
  }

  if (input.action === "ignore") {
    return withPrismaRetry(() =>
      prisma.statementEntry.update({
        where: { id: entryId },
        data: {
          matchStatus: "IGNORED",
          registrationId: null,
          orderId: null,
          matchNote: `Marcado como externo (não é inscrição) por ${who}.`,
        },
      })
    );
  }

  const { registrationId, orderId } = input;
  if ((registrationId ? 1 : 0) + (orderId ? 1 : 0) !== 1) {
    throw new AuditError("Informe uma inscrição ou um pedido para vincular.");
  }
  const target = registrationId
    ? await withPrismaRetry(() => prisma.registration.findUnique({ where: { id: registrationId }, select: { id: true } }))
    : await withPrismaRetry(() => prisma.order.findUnique({ where: { id: orderId! }, select: { id: true } }));
  if (!target) throw new AuditError("Inscrição ou pedido não encontrado", 404);

  const taken = await withPrismaRetry(() =>
    prisma.statementEntry.findFirst({
      where: {
        id: { not: entryId },
        matchStatus: { in: [...LINKED_STATUSES] },
        ...(registrationId ? { registrationId } : { orderId }),
      },
      select: { id: true },
    })
  );
  if (taken) throw new AuditError("Esta inscrição já está vinculada a outro recebimento.", 409);

  return withPrismaRetry(() =>
    prisma.statementEntry.update({
      where: { id: entryId },
      data: {
        matchStatus: "RESOLVED_MANUAL",
        registrationId: registrationId ?? null,
        orderId: orderId ?? null,
        matchNote: `Vinculado manualmente por ${who}.`,
      },
    })
  );
}
