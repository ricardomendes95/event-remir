import { nameSimilarity } from "./nameSimilarity";

/**
 * Conciliação PURA (sem Prisma): casa as linhas do extrato InfinitePay com as
 * inscrições/pedidos confirmados. Como o extrato não tem NSU, o casamento é por
 * valor + horário + nome do pagador, de forma conservadora: falso "conferido" é
 * pior que falso "pendente". Só vira MATCHED automático quando UM único
 * candidato atende aos três critérios; o resto vira sugestão para vínculo manual.
 */

export type EntryKind = "PIX_RECEIVED" | "PIX_SENT" | "SALES_DEPOSIT" | "OTHER";

export type ReconcileStatus =
  | "MATCHED"
  | "AMOUNT_MISMATCH"
  | "UNMATCHED"
  | "DUPLICATE_PAYMENT"
  | "ACCOUNT_MOVEMENT";

export interface ReconcileEntry {
  key: string;
  kind: EntryKind;
  payerName: string;
  /** Com sinal; só entradas (positivo) entram na conciliação. */
  amountCents: number;
  paidAt: Date;
}

export type PaymentChannel = "PIX" | "CREDIT" | "UNKNOWN";

export interface ReconcileCandidate {
  /** Ex.: `registration:abc` ou `order:xyz`. */
  id: string;
  /** Nomes aceitos para o pagador: participante(s) e responsável. */
  names: string[];
  /** Valores aceitos em centavos (valor enviado e valor pago registrados). */
  amountsCents: number[];
  paidAt: Date | null;
  /** false = data aproximada (ex.: updatedAt); impede casamento automático. */
  paidAtExact: boolean;
  channel: PaymentChannel;
  /** Já vinculado a uma linha em importação anterior. */
  consumed?: boolean;
  /** Inscrição estornada depois do pagamento: casa, mas não é "sem recebimento". */
  refunded?: boolean;
}

export interface ReconcileOptions {
  /** Janela de horário entre extrato e pagamento registrado. Padrão 30 min. */
  timeWindowMinutes?: number;
  /** Tolerância de valor em centavos. Padrão 5 (R$ 0,05). */
  amountToleranceCents?: number;
  /** Similaridade mínima de nome (0–1). Padrão 0.6. */
  minNameSimilarity?: number;
  /** Máximo de sugestões por linha. Padrão 3. */
  maxSuggestions?: number;
  /**
   * Janela "mesmo minuto" (padrão 2 min): o webhook registra o pagamento no
   * mesmo minuto do Pix no extrato, então valor + horário exato com um único
   * candidato basta, mesmo quando quem pagou não é o inscrito.
   */
  exactTimeWindowMinutes?: number;
}

export interface Suggestion {
  candidateId: string;
  score: number;
}

export interface EntryResult {
  key: string;
  status: ReconcileStatus;
  candidateId: string | null;
  note: string | null;
  suggestions: Suggestion[];
}

export const DEFAULT_OPTIONS: Required<ReconcileOptions> = {
  timeWindowMinutes: 30,
  amountToleranceCents: 5,
  minNameSimilarity: 0.6,
  maxSuggestions: 3,
  exactTimeWindowMinutes: 2,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Evaluation {
  candidate: ReconcileCandidate;
  nameScore: number;
  amountOk: boolean;
  timeOk: boolean;
  exactTime: boolean;
  sameDay: boolean;
}

function evaluate(
  entry: ReconcileEntry,
  candidate: ReconcileCandidate,
  opts: Required<ReconcileOptions>
): Evaluation {
  const nameScore = candidate.names.reduce(
    (best, name) => Math.max(best, nameSimilarity(entry.payerName, name)),
    0
  );
  const amountOk = candidate.amountsCents.some(
    (a) => Math.abs(a - entry.amountCents) <= opts.amountToleranceCents
  );
  const diff = candidate.paidAt
    ? Math.abs(candidate.paidAt.getTime() - entry.paidAt.getTime())
    : Infinity;
  return {
    candidate,
    nameScore,
    amountOk,
    timeOk: candidate.paidAtExact && diff <= opts.timeWindowMinutes * 60 * 1000,
    exactTime: candidate.paidAtExact && diff <= opts.exactTimeWindowMinutes * 60 * 1000,
    sameDay: diff <= DAY_MS,
  };
}

function suggestionScore(e: Evaluation): number {
  return (
    0.5 * e.nameScore +
    0.3 * (e.amountOk ? 1 : 0) +
    0.2 * (e.timeOk ? 1 : e.sameDay ? 0.5 : 0)
  );
}

export function reconcile(
  entries: ReconcileEntry[],
  candidates: ReconcileCandidate[],
  options: ReconcileOptions = {}
): { results: EntryResult[]; unmatchedCandidates: ReconcileCandidate[] } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const consumed = new Set(candidates.filter((c) => c.consumed).map((c) => c.id));
  // Cartão não aparece como Pix no extrato: fora do casamento linha a linha.
  const pixCandidates = candidates.filter((c) => c.channel !== "CREDIT");

  const resultByKey = new Map<string, EntryResult>();
  const ordered = [...entries].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());

  for (const entry of ordered) {
    if (entry.kind !== "PIX_RECEIVED") {
      resultByKey.set(entry.key, {
        key: entry.key,
        status: "ACCOUNT_MOVEMENT",
        candidateId: null,
        note: null,
        suggestions: [],
      });
      continue;
    }

    const evals = pixCandidates.map((c) => evaluate(entry, c, opts));
    const strong = (e: Evaluation) =>
      e.amountOk && e.timeOk && e.nameScore >= opts.minNameSimilarity;

    const fresh = evals.filter((e) => !consumed.has(e.candidate.id));
    const strongFresh = fresh.filter(strong);

    if (strongFresh.length === 1) {
      const c = strongFresh[0].candidate;
      consumed.add(c.id);
      resultByKey.set(entry.key, {
        key: entry.key,
        status: "MATCHED",
        candidateId: c.id,
        note: c.refunded ? "Inscrição estornada depois deste pagamento." : null,
        suggestions: [],
      });
      continue;
    }

    if (strongFresh.length === 0) {
      const exactFresh = fresh.filter((e) => e.amountOk && e.exactTime);
      if (exactFresh.length === 1) {
        const e = exactFresh[0];
        consumed.add(e.candidate.id);
        const notes = [
          e.nameScore < opts.minNameSimilarity
            ? "Pago por outra pessoa: o nome no Pix é diferente do inscrito."
            : null,
          e.candidate.refunded ? "Inscrição estornada depois deste pagamento." : null,
        ].filter(Boolean);
        resultByKey.set(entry.key, {
          key: entry.key,
          status: "MATCHED",
          candidateId: e.candidate.id,
          note: notes.length ? notes.join(" ") : null,
          suggestions: [],
        });
        continue;
      }

      const dup = evals.filter((e) => consumed.has(e.candidate.id) && strong(e));
      if (dup.length > 0) {
        resultByKey.set(entry.key, {
          key: entry.key,
          status: "DUPLICATE_PAYMENT",
          candidateId: dup[0].candidate.id,
          note: "Pagamento igual a outro já conferido: possível Pix em duplicidade.",
          suggestions: [],
        });
        continue;
      }

      // Nome e horário batem com um único candidato, mas o valor não.
      const nearMiss = fresh.filter(
        (e) => !e.amountOk && e.timeOk && e.nameScore >= opts.minNameSimilarity
      );
      if (nearMiss.length === 1) {
        const c = nearMiss[0].candidate;
        consumed.add(c.id);
        const expected = c.amountsCents[c.amountsCents.length - 1];
        resultByKey.set(entry.key, {
          key: entry.key,
          status: "AMOUNT_MISMATCH",
          candidateId: c.id,
          note: `Recebido ${formatCents(entry.amountCents)}; esperado ${formatCents(expected)}.`,
          suggestions: [],
        });
        continue;
      }
    }

    const suggestions = fresh
      .filter((e) => e.nameScore >= 0.5 || (e.amountOk && e.sameDay))
      .map((e) => ({ candidateId: e.candidate.id, score: Number(suggestionScore(e).toFixed(2)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.maxSuggestions);

    resultByKey.set(entry.key, {
      key: entry.key,
      status: "UNMATCHED",
      candidateId: null,
      note:
        strongFresh.length > 1
          ? "Mais de uma inscrição combina com este pagamento; confira e vincule manualmente."
          : null,
      suggestions,
    });
  }

  return {
    results: entries.map((e) => resultByKey.get(e.key)!),
    unmatchedCandidates: candidates.filter((c) => !consumed.has(c.id)),
  };
}

/** Candidatos sem recebimento no extrato dentro do período (direção inversa). */
export function findUncovered(
  candidates: ReconcileCandidate[],
  linkedIds: Set<string>,
  period: { start: Date; end: Date }
): ReconcileCandidate[] {
  return candidates.filter(
    (c) =>
      !linkedIds.has(c.id) &&
      !c.refunded &&
      c.paidAt !== null &&
      c.paidAt.getTime() >= period.start.getTime() &&
      c.paidAt.getTime() <= period.end.getTime()
  );
}
