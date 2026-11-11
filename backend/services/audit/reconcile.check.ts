/**
 * Verificação executável da auditoria (parser + conciliação), sem runner novo:
 *   npx tsx backend/services/audit/reconcile.check.ts
 * Usa a fixture sintética de docs/melhorias-2.0/fixtures. Opcionalmente valida o
 * parser contra um extrato real: AUDIT_REAL_SAMPLE=/caminho/relatorio.csv
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseStatement, parseMoneyToCents } from "./statementParser";
import { parseCsv } from "@/backend/utils/csvParser";
import { reconcile, findUncovered, type ReconcileCandidate } from "./reconcile";

const brt = (iso: string) => new Date(`${iso}-03:00`);
const fixture = readFileSync(
  join(process.cwd(), "docs/melhorias-2.0/fixtures/extrato-infinitepay-sintetico.csv"),
  "utf8"
);

// --- Parser
assert.equal(parseMoneyToCents("+R$ 1.234,56"), 123456);
assert.equal(parseMoneyToCents("-R$ 30,00"), -3000);
assert.equal(parseMoneyToCents("abc"), null);
assert.deepEqual(parseCsv('﻿a;b\n"x;y";"z""w"\r\n'), [["a", "b"], ["x;y", 'z"w']]);
assert.throws(() => parseCsv('a,b\n"aberto'));
assert.throws(() => parseStatement("Data,Hora\n2026-07-10,10:00:00"), /Colunas não encontradas/);
assert.throws(
  () => parseStatement("Data,Hora,Tipo de transação,Nome,Detalhe,Valor\n2026-13-40,10:00:00,Pix,A B,Recebido,+R$ 1,00"),
  /inválidos/
);

const parsed = parseStatement(fixture);
assert.equal(parsed.rows.length, 12);
const kinds = (k: string) => parsed.rows.filter((r) => r.kind === k).length;
assert.equal(kinds("PIX_RECEIVED"), 10);
assert.equal(kinds("PIX_SENT"), 1);
assert.equal(kinds("SALES_DEPOSIT"), 1);
// Linhas idênticas têm ids distintos; reparse gera os mesmos ids (idempotência)
const identical = parsed.rows.filter((r) => r.payerName === "Rafael Teixeira");
assert.notEqual(identical[0].externalId, identical[1].externalId);
assert.deepEqual(
  parseStatement(fixture).rows.map((r) => r.externalId),
  parsed.rows.map((r) => r.externalId)
);
assert.equal(parsed.rows[0].paidAt.toISOString(), "2026-07-10T12:15:02.000Z"); // Brasília -> UTC

// --- Conciliação
const candidates: ReconcileCandidate[] = [
  { id: "registration:mariana", names: ["Mariana Costa Lima"], amountsCents: [3000], paidAt: brt("2026-07-10T09:14:40"), paidAtExact: true, channel: "PIX" },
  { id: "registration:joao", names: ["João Pedro Almeida"], amountsCents: [6000], paidAt: brt("2026-07-10T10:01:50"), paidAtExact: true, channel: "PIX" },
  { id: "registration:beatriz", names: ["Beatriz Nunes Rocha"], amountsCents: [3000], paidAt: brt("2026-07-10T11:19:00"), paidAtExact: true, channel: "PIX" },
  { id: "registration:ana1", names: ["Ana Beatriz Rocha"], amountsCents: [9000], paidAt: brt("2026-07-10T12:29:30"), paidAtExact: true, channel: "PIX" },
  { id: "registration:ana2", names: ["Ana Beatriz Rocha"], amountsCents: [9000], paidAt: brt("2026-07-10T12:29:40"), paidAtExact: true, channel: "PIX" },
  { id: "order:grupo", names: ["Paulo Henrique Souza", "Marta Souza", "Tiago Souza"], amountsCents: [18000], paidAt: brt("2026-07-11T07:59:30"), paidAtExact: true, channel: "PIX" },
  { id: "registration:lucia", names: ["Lucia Ferreira"], amountsCents: [4500], paidAt: brt("2026-07-11T15:44:00"), paidAtExact: true, channel: "PIX" },
  { id: "registration:cartao", names: ["Helena Duarte"], amountsCents: [6000], paidAt: brt("2026-07-11T10:00:00"), paidAtExact: true, channel: "CREDIT" },
  { id: "registration:sem-extrato", names: ["Otavio Prado"], amountsCents: [3000], paidAt: brt("2026-07-12T09:00:00"), paidAtExact: true, channel: "PIX" },
];
const entries = parsed.rows.map((r) => ({
  key: r.externalId, kind: r.kind, payerName: r.payerName, amountCents: r.amountCents, paidAt: r.paidAt,
}));
const { results, unmatchedCandidates } = reconcile(entries, candidates);
const byName = (name: string, n = 0) =>
  results[parsed.rows.findIndex((r, i) => r.payerName === name && parsed.rows.filter((x, j) => j < i && x.payerName === name).length === n)];

assert.equal(byName("Mariana Costa Lima", 0).status, "MATCHED");
assert.equal(byName("Mariana Costa Lima", 0).candidateId, "registration:mariana");
assert.equal(byName("Mariana Costa Lima", 1).status, "DUPLICATE_PAYMENT");
assert.equal(byName("Joao P Almeida").status, "MATCHED"); // centavo extra (60,01) dentro da tolerância
const carlos = byName("Carlos Eduardo Nunes"); // nome diferente, mesmo minuto e valor, candidato único -> conferido
assert.equal(carlos.status, "MATCHED");
assert.equal(carlos.candidateId, "registration:beatriz");
assert.match(carlos.note ?? "", /outra pessoa/);
const ana = byName("Ana Beatriz Rocha"); // dois candidatos iguais -> sugestão
assert.equal(ana.status, "UNMATCHED");
assert.deepEqual(ana.suggestions.slice(0, 2).map((s) => s.candidateId).sort(), ["registration:ana1", "registration:ana2"]);
assert.equal(byName("Paulo Henrique Souza").status, "MATCHED"); // pedido em grupo (180,02)
assert.equal(byName("Paulo Henrique Souza").candidateId, "order:grupo");
assert.equal(byName("Lucia Ferreira").status, "AMOUNT_MISMATCH");
assert.equal(byName("Pessoa Desconhecida").status, "UNMATCHED");
assert.equal(byName("Pessoa Desconhecida").suggestions.length, 0);
assert.equal(byName("Fornecedor Exemplo Ltda").status, "ACCOUNT_MOVEMENT");
assert.equal(results[results.length - 1].status, "ACCOUNT_MOVEMENT");
// Cartão nunca casa com Pix
assert.ok(!results.some((r) => r.candidateId === "registration:cartao"));

// Direção inversa
const linked = new Set(results.filter((r) => r.status === "MATCHED" || r.status === "AMOUNT_MISMATCH").map((r) => r.candidateId!));
const uncovered = findUncovered(unmatchedCandidates, linked, {
  start: brt("2026-07-10T00:00:00"), end: brt("2026-07-13T23:59:59"),
}).map((c) => c.id).sort();
assert.deepEqual(uncovered, ["registration:ana1", "registration:ana2", "registration:cartao", "registration:sem-extrato"].sort());

// Candidato com data aproximada nunca casa automaticamente
const approx = reconcile(
  [{ key: "k", kind: "PIX_RECEIVED", payerName: "Mariana Costa Lima", amountCents: 3000, paidAt: brt("2026-07-10T09:15:00") }],
  [{ ...candidates[0], paidAtExact: false }]
);
assert.equal(approx.results[0].status, "UNMATCHED");

// --- Amostra real (opcional): só contagens, sem imprimir conteúdo
if (process.env.AUDIT_REAL_SAMPLE) {
  const real = parseStatement(readFileSync(process.env.AUDIT_REAL_SAMPLE, "utf8"));
  const count = (k: string) => real.rows.filter((r) => r.kind === k).length;
  console.log(`amostra real: ${real.rows.length} linhas | Pix recebido ${count("PIX_RECEIVED")} | Pix enviado ${count("PIX_SENT")} | depósitos ${count("SALES_DEPOSIT")} | outros ${count("OTHER")} | ids únicos ${new Set(real.rows.map((r) => r.externalId)).size}`);
}

console.log("auditoria: todas as verificações passaram");

// Nome diferente e horário fora do mesmo minuto -> só sugestão, nunca automático
const farOther = reconcile(
  [{ key: "f", kind: "PIX_RECEIVED", payerName: "Carlos Eduardo Nunes", amountCents: 3000, paidAt: brt("2026-07-10T11:30:00") }],
  [{ id: "registration:beatriz", names: ["Beatriz Nunes Rocha"], amountsCents: [3000], paidAt: brt("2026-07-10T11:19:00"), paidAtExact: true, channel: "PIX" }]
);
assert.equal(farOther.results[0].status, "UNMATCHED");
assert.equal(farOther.results[0].suggestions[0]?.candidateId, "registration:beatriz");

// Mesma pessoa, pedidos iguais em sequência (dentro de 30 min): o horário exato desempata
const seq = reconcile(
  [
    { key: "s1", kind: "PIX_RECEIVED", payerName: "Mariana Costa Lima", amountCents: 18000, paidAt: brt("2026-07-10T14:13:19") },
    { key: "s2", kind: "PIX_RECEIVED", payerName: "Mariana Costa Lima", amountCents: 18000, paidAt: brt("2026-07-10T14:27:09") },
  ],
  [
    { id: "order:a", names: ["Mariana Costa Lima"], amountsCents: [18000], paidAt: brt("2026-07-10T14:13:19"), paidAtExact: true, channel: "PIX" },
    { id: "order:b", names: ["Mariana Costa Lima"], amountsCents: [18000], paidAt: brt("2026-07-10T14:27:09"), paidAtExact: true, channel: "PIX" },
  ]
);
assert.deepEqual(seq.results.map((r) => [r.status, r.candidateId]), [["MATCHED", "order:a"], ["MATCHED", "order:b"]]);

// Dois candidatos na janela de 2 min, só um no mesmo minuto -> conferido com ele
const sameMin = reconcile(
  [{ key: "m", kind: "PIX_RECEIVED", payerName: "Roberto Alves", amountCents: 3000, paidAt: brt("2026-07-10T10:00:00") }],
  [
    { id: "registration:x", names: ["Clara Mendes"], amountsCents: [3000], paidAt: brt("2026-07-10T10:00:20"), paidAtExact: true, channel: "PIX" },
    { id: "registration:y", names: ["Davi Lopes"], amountsCents: [3000], paidAt: brt("2026-07-10T10:02:00"), paidAtExact: true, channel: "PIX" },
  ]
);
assert.equal(sameMin.results[0].status, "MATCHED");
assert.equal(sameMin.results[0].candidateId, "registration:x");
