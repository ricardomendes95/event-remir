# Requisito 6 — Auditoria financeira do InfinitePay

- **Status**: 🔍 RFC pronto (aguardando aprovação) — depende do ADR-001 e de amostra real de extrato
- **Ordem no roadmap**: 6ª
- **Requisito original**: `../requisitos.md` (item 6)
- **RFC escrito em**: 2026-07-24

## Objetivo e escopo

Tela de auditoria que confere os pagamentos recebidos no InfinitePay contra as inscrições/pedidos do sistema: conciliados, divergentes, não encontrados no sistema, não pagos no gateway, duplicados.

**Estratégia definida pela pesquisa P-04 (2026-07-24)**: a API pública do InfinitePay **não oferece listagem de transações** — sincronização automática é inviável. A auditoria será por **importação do extrato exportado do painel InfinitePay**, complementada pelo `payment_check` (`POST api.checkout.infinitepay.io/payment_check`) para verificação pontual sob demanda de um pagamento específico.

**Fora de escopo**: conciliação bancária (extrato do banco da igreja); OFX na primeira versão (ver decisão D2); dashboards — resultado da auditoria alimenta o req. 10.

## Estado atual do código (verificado em 2026-07-24)

- Webhook (`app/api/payments/webhook/infinitepay/route.ts`) persiste o payload estruturado em `Registration.paymentDetails` JSON: `orderNsu`, `transactionNsu`, `invoiceSlug`, `amount`, `paidAmount`, `installments`, `captureMethod`, `receiptUrl`, `dateProcessed`. É a única fonte interna de transação hoje.
- `paymentId` recebe `transactionNsu` (ou `order_nsu`) na confirmação — inscrições confirmadas por webhook são conciliáveis por esse campo.
- Não existe tabela de transações — o ADR-001 (colunas tipadas no `Order`) estrutura isso **para pedidos novos**; o histórico permanece em JSON (R-03).
- `payment_check` não é usado no código hoje (`payments/status` consulta o banco local).

## Decisões de produto/UX

- Fluxo do admin: exportar CSV no painel InfinitePay → upload na tela de auditoria → sistema apresenta o resultado do matching com resumo e tabela filtrable → admin resolve pendências (vincular manualmente / marcar como externo).
- Classificações exibidas em linguagem simples: **Conferido** · **Valor divergente** · **Recebido sem inscrição correspondente** · **Inscrição confirmada sem recebimento no extrato** · **Recebido em duplicidade**.
- Cada importação fica registrada (quem, quando, arquivo, período) — auditoria permanente, não uma tela efêmera.
- Acesso: **ADMIN/SUPER_ADMIN** (valores financeiros — ADR-002 exclui CHECKIN/SUPPORT).

## Arquitetura proposta

### Schema (aditivo; complementa o ADR-001)

```prisma
model StatementImport {
  id          String   @id @default(cuid())
  fileName    String
  importedById String              // Admin.id
  periodStart DateTime?
  periodEnd   DateTime?
  totalRows   Int
  createdAt   DateTime @default(now())
  entries     StatementEntry[]
  @@map("statement_imports")
}

model StatementEntry {
  id             String   @id @default(cuid())
  importId       String
  import         StatementImport @relation(fields: [importId], references: [id], onDelete: Cascade)
  externalId     String            // identificador da transação no extrato (transaction_nsu/NSU)
  description    String?
  amountCents    Int
  paidAt         DateTime?
  raw            Json              // linha original completa (formato pode evoluir)
  matchStatus    MatchStatus @default(UNMATCHED)
  registrationId String?           // vínculo resolvido (auto ou manual)
  orderId        String?           // quando ADR-001 existir
  matchNote      String?           // ex.: "vinculado manualmente por X"
  createdAt      DateTime @default(now())
  @@index([importId])
  @@index([externalId])
  @@map("statement_entries")
}

enum MatchStatus { MATCHED AMOUNT_MISMATCH UNMATCHED DUPLICATE RESOLVED_MANUAL IGNORED }
```

Reimportação do mesmo período: entradas com `externalId` já existente em outra importação são marcadas `DUPLICATE` (não geram novo pendente) — idempotência de importação.

### Serviço de conciliação (`backend/services/audit/reconciliationService.ts`)

Matching em passes, do mais forte para o mais fraco (regras conservadoras — falso "ok" é pior que falso "pendente"):

1. `externalId` = `Order.transactionNsu` (pedidos novos, ADR-001).
2. `externalId` = `Registration.paymentId` (confirmadas via webhook, inclusive legadas).
3. `externalId` dentro de `Registration.paymentDetails.transactionNsu` (JSON legado).
4. Sem match de id: **não** casa por valor+data automaticamente — vira sugestão ("possível correspondência") para vínculo **manual**.
5. Conferência de valor: match de id com `amountCents` divergente do esperado (`resolveBaseValue`/`Order.totalValue`) → `AMOUNT_MISMATCH`.

Direção inversa (inscrição sem extrato): inscrições `CONFIRMED` com `paymentMethod = INFINITE_PAY` no período importado sem entrada casada → listadas como "sem recebimento no extrato".

### Parser

- **CSV** próprio e pequeno (`backend/utils/csvParser.ts`): o formato do extrato é simples; parser tolerante a aspas/;/, e cabeçalhos variáveis por mapa de colunas. **Sem dependência nova** (regra 9 do `08_AI_RULES.md`) — ver decisão D2.
- Colunas reais só serão confirmadas com uma **amostra do extrato** (pendência com o Ricardo) — o mapa de colunas é configurável em um único lugar para absorver mudanças de formato.
- Amostras reais anonimizadas guardadas como fixture em `docs/melhorias-2.0/fixtures/` (sem CPF/nomes reais).

### Rotas e telas

| Rota | Acesso | Função |
|---|---|---|
| `POST /api/admin/audit/import` | ADMIN+ | upload CSV (multipart), parse + conciliação, retorna resumo |
| `GET /api/admin/audit/imports` / `GET .../imports/[id]` | ADMIN+ | histórico e detalhe com filtros por `matchStatus` |
| `PATCH /api/admin/audit/entries/[id]` | ADMIN+ | vincular manualmente a inscrição/pedido, ignorar, desfazer |
| `POST /api/admin/audit/payment-check` | ADMIN+ | consulta pontual `payment_check` no InfinitePay para uma inscrição/pedido |

Tela `/admin/financial/audit` (ou aba "Auditoria" no financeiro — alinhar com Q8 do req. 12): upload, cards de resumo por classificação, tabela com filtros e ações. Rotas em `adminRoutes` + `config.matcher`; Zod + `withPrismaRetry` + envelope em tudo.

## Alternativas consideradas

- **Sincronização automática via API**: inviável (P-04 — não existe endpoint de listagem).
- **Scraping/exportação automatizada do painel**: frágil e fora dos termos de uso — descartado.
- **Só enriquecer o webhook, sem importação**: o webhook não vê o que **não** chegou (pagamento perdido, duplicado no gateway) — não cumpre o requisito de conferência.
- **D2 — Suportar OFX na v1**: adiado. OFX é SGML e o CSV do painel cobre o mesmo conteúdo; se na amostra real o CSV se mostrar insuficiente, reavaliamos (registrar em `../decisoes.md` se virar dependência nova de parser).
- **Matching automático por valor+data**: rejeitado como automático (risco de falso positivo com valores repetidos — vários pagamentos de R$ 90 no mesmo dia); mantido apenas como sugestão para ação humana.

## Riscos e mitigação

- Formato do CSV muda sem aviso → mapa de colunas centralizado + fixture de referência + erro de parse vira mensagem clara (não importa nada parcialmente: importação é transacional).
- Histórico sem identificadores (`paymentDetails` legado incompleto) → classificado como pendente com sugestão, nunca erro; comunicado na tela.
- Upload de arquivo: limite de tamanho (~2 MB), extensão .csv, conteúdo tratado como não confiável (sem eval de fórmulas — cuidado com CSV injection ao reexportar).
- Dados pessoais no extrato → armazenar apenas colunas necessárias em campos tipados; `raw` fica restrito a rotas ADMIN+.

## Perguntas abertas

- **Q10**: Ricardo consegue exportar uma **amostra real de CSV** (e um OFX, para arquivarmos) do painel InfinitePay antes da implementação? Sem ela, o mapa de colunas fica bloqueado.
- **Q11**: a tela vive dentro do Financeiro (aba "Auditoria" — recomendado, mesmo lugar mental de prestação de contas) ou como item próprio no menu admin?

## Plano de implementação

1. Obter amostra real do extrato (Q10) e fixar o mapa de colunas.
2. Schema: `StatementImport`/`StatementEntry` + enum → `db push` local. (Se o req. 2/ADR-001 ainda não tiver sido implementado, os campos `orderId` ficam prontos mas sem uso — sem acoplamento.)
3. Parser CSV + testes com a fixture.
4. Serviço de conciliação (passes 1–5) — função pura testável.
5. Rotas admin (upload transacional, listagem, ações manuais, payment_check) + middleware.
6. Tela de auditoria (upload, resumo, tabela, ações) — AntD, padrão do admin.
7. Direção inversa (confirmadas sem extrato) integrada ao detalhe da importação.
8. Verificação (`tsc`/lint/build) + matriz abaixo; atualizar documentação.

## Critérios de aceite / testes manuais

- Importar extrato real → pagamentos via site casam automaticamente (por `transactionNsu`/`paymentId`); resumo bate com o painel.
- Linha com valor divergente → `AMOUNT_MISMATCH` destacado.
- Pagamento no extrato sem inscrição → listado como "sem correspondência" com sugestões.
- Inscrição confirmada sem linha no extrato do período → listada na direção inversa.
- Reimportar o mesmo arquivo → nenhuma pendência duplicada (idempotência).
- Vincular manualmente e desfazer → estados corretos e auditados (`matchNote`).
- `payment_check` pontual retorna e exibe o status real do gateway.
- CHECKIN/SUPPORT → 403 nas rotas; tela invisível no menu.
- CSV malformado → erro claro, nada importado.

## Checklist

- [x] P-04: pesquisa sobre API de transações → **não existe; estratégia = importação de CSV + payment_check**
- [ ] ADR-001 aprovado (colunas tipadas de transação)
- [ ] Q10 (amostra real de extrato) e Q11 respondidas
- [x] Análise técnica completa e estratégia definida
- [ ] Schema de importação + `db push`
- [ ] Backend (parser, conciliação, rotas)
- [ ] Frontend (tela de auditoria)
- [ ] Testes com extratos reais (ver `../testes.md`)
- [ ] Documentação atualizada
- [ ] Aprovação do Ricardo

## Progresso / Arquivos alterados / Testes realizados / Pendências

_(preencher durante a implementação)_
