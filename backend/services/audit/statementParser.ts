import { createHash } from "crypto";
import { CsvParseError, parseCsv } from "@/backend/utils/csvParser";
import { normalizeName } from "./nameSimilarity";

/**
 * Parser do extrato de movimentações exportado do painel InfinitePay.
 * Formato (amostra real de 2026-11-11): `Data,Hora,Tipo de transação,Nome,Detalhe,Valor`
 * com data AAAA-MM-DD, hora HH:MM:SS (horário de Brasília) e valor `+R$ 1.234,56`.
 * O extrato NÃO tem NSU — o externalId é sintético (ver buildExternalId).
 */

export type StatementKind = "PIX_RECEIVED" | "PIX_SENT" | "SALES_DEPOSIT" | "OTHER";

export interface ParsedStatementRow {
  line: number;
  externalId: string;
  kind: StatementKind;
  payerName: string;
  description: string;
  /** Com sinal: positivo = entrada, negativo = saída. */
  amountCents: number;
  paidAt: Date;
  raw: Record<string, string>;
}

export interface ParsedStatement {
  rows: ParsedStatementRow[];
  periodStart: Date;
  periodEnd: Date;
}

export const MAX_ROWS = 20000;

/** Único lugar que conhece os nomes das colunas (normalizados, sem acento/caixa). */
const COLUMN_ALIASES = {
  date: ["data"],
  time: ["hora"],
  type: ["tipo de transacao", "tipo"],
  name: ["nome"],
  detail: ["detalhe"],
  amount: ["valor"],
} as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** `+R$ 1.234,56` / `-R$ 30,00` / `R$ 5,00` → centavos com sinal; null se inválido. */
export function parseMoneyToCents(value: string): number | null {
  const match = value
    .replace(/ /g, " ")
    .trim()
    .match(/^([+-])?\s*(?:R\$)?\s*([+-])?\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/);
  if (!match) return null;
  const sign = match[1] === "-" || match[2] === "-" ? -1 : 1;
  const reais = Number(match[3].replace(/\./g, ""));
  const cents = Number((match[4] ?? "").padEnd(2, "0") || "0");
  return sign * (reais * 100 + cents);
}

/** Data e hora do extrato (Brasília, UTC-3 sem horário de verão) → Date em UTC. */
export function parseBrasiliaDateTime(date: string, time: string): Date | null {
  const d = date.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const t = time.trim().match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!d || !t) return null;
  const iso = `${d[1]}-${d[2]}-${d[3]}T${t[1]}:${t[2]}:${t[3] ?? "00"}-03:00`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  // Rejeita datas inexistentes (ex.: 2026-02-31)
  const check = new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3])));
  if (check.getUTCDate() !== Number(d[3])) return null;
  return parsed;
}

function classify(type: string, detail: string, amountCents: number): StatementKind {
  const t = normalizeHeader(type);
  const d = normalizeHeader(detail);
  if (t === "pix" && d === "recebido" && amountCents > 0) return "PIX_RECEIVED";
  if (t === "pix" && d === "enviado") return "PIX_SENT";
  if (t.startsWith("deposito de vendas")) return "SALES_DEPOSIT";
  return "OTHER";
}

/** Hash estável da linha; `occurrence` distingue linhas idênticas no mesmo arquivo. */
export function buildExternalId(
  parts: { date: string; time: string; type: string; name: string; amountCents: number },
  occurrence: number
): string {
  const base = [
    parts.date.trim(),
    parts.time.trim(),
    normalizeHeader(parts.type),
    normalizeName(parts.name),
    String(parts.amountCents),
  ].join("|");
  const hash = createHash("sha256").update(base).digest("hex").slice(0, 32);
  return `${hash}-${occurrence}`;
}

/**
 * Lê o CSV inteiro; qualquer problema vira CsvParseError (nada é importado
 * parcialmente). O conteúdo é tratado como dado, nunca avaliado.
 */
export function parseStatement(text: string): ParsedStatement {
  const table = parseCsv(text);
  if (table.length < 2) {
    throw new CsvParseError("O arquivo está vazio ou não tem linhas de movimentação.");
  }
  if (table.length - 1 > MAX_ROWS) {
    throw new CsvParseError(`O arquivo tem linhas demais (máximo ${MAX_ROWS}).`);
  }

  const header = table[0].map(normalizeHeader);
  const index = {} as Record<ColumnKey, number>;
  const missing: string[] = [];
  (Object.keys(COLUMN_ALIASES) as ColumnKey[]).forEach((key) => {
    const found = header.findIndex((h) =>
      (COLUMN_ALIASES[key] as readonly string[]).includes(h)
    );
    if (found === -1) missing.push(COLUMN_ALIASES[key][0]);
    index[key] = found;
  });
  if (missing.length > 0) {
    throw new CsvParseError(
      `Este não parece o extrato do InfinitePay. Colunas não encontradas: ${missing.join(", ")}.`
    );
  }

  const occurrences = new Map<string, number>();
  const rows: ParsedStatementRow[] = [];
  const problems: string[] = [];

  for (let i = 1; i < table.length; i++) {
    const cells = table[i];
    const line = i + 1;
    const get = (key: ColumnKey) => (cells[index[key]] ?? "").trim();

    const paidAt = parseBrasiliaDateTime(get("date"), get("time"));
    const amountCents = parseMoneyToCents(get("amount"));
    if (!paidAt || amountCents === null) {
      problems.push(`linha ${line}`);
      continue;
    }

    const parts = {
      date: get("date"),
      time: get("time"),
      type: get("type"),
      name: get("name"),
      amountCents,
    };
    const baseKey = [parts.date, parts.time, normalizeHeader(parts.type), normalizeName(parts.name), amountCents].join("|");
    const occurrence = (occurrences.get(baseKey) ?? 0) + 1;
    occurrences.set(baseKey, occurrence);

    rows.push({
      line,
      externalId: buildExternalId(parts, occurrence),
      kind: classify(get("type"), get("detail"), amountCents),
      payerName: get("name"),
      description: [get("type"), get("detail")].filter(Boolean).join(" · "),
      amountCents,
      paidAt,
      raw: {
        Data: get("date"),
        Hora: get("time"),
        "Tipo de transação": get("type"),
        Nome: get("name"),
        Detalhe: get("detail"),
        Valor: get("amount"),
      },
    });
  }

  if (problems.length > 0) {
    const shown = problems.slice(0, 5).join(", ");
    const extra = problems.length > 5 ? ` e mais ${problems.length - 5}` : "";
    throw new CsvParseError(
      `Data, hora ou valor inválidos (${shown}${extra}). Nada foi importado.`
    );
  }

  const times = rows.map((r) => r.paidAt.getTime());
  return {
    rows,
    periodStart: new Date(Math.min(...times)),
    periodEnd: new Date(Math.max(...times)),
  };
}
