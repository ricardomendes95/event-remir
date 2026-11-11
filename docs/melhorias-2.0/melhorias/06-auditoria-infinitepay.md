# Requisito 6 — Auditoria financeira do InfinitePay

- **Status**: ✅ Implementado (2026-11-11) — aguardando validação visual/aprovação do Ricardo
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
- [x] ADR-001 aprovado e implementado (`Order` com colunas tipadas)
- [x] Q10 (amostra real recebida em 2026-11-11) e Q11 respondidas
- [x] Análise técnica completa e estratégia definida
- [x] Schema de importação + `db push` (local)
- [x] Backend (parser, conciliação, rotas)
- [x] Frontend (aba "Auditoria" no Financeiro)
- [x] Testes com fixture sintética + parse da amostra real (contagens); conferência com inscrições reais pendente
- [x] Documentação atualizada
- [ ] Aprovação do Ricardo

## Progresso / Arquivos alterados / Testes realizados / Pendências

### Desenho de matching revisado (extrato sem NSU)
- `externalId` sintético: `sha256(data|hora|tipo|nome normalizado|valor)[0..32]-<ocorrência>`; linhas idênticas ganham ocorrência distinta; reimportar o mesmo arquivo marca tudo como `DUPLICATE` ("Já importado antes").
- Só `Pix Recebido` é conciliado; `Pix Enviado`, `Depósito de vendas` e outros tipos viram `ACCOUNT_MOVEMENT` ("Movimentação da conta"). Cartão não é conferível linha a linha (a tela explica).
- Função pura `reconcile(entries, candidates, options)` em `backend/services/audit/reconcile.ts`. `MATCHED` automático só com **um único** candidato que atenda aos três critérios: valor (tolerância R$ 0,05), horário de pagamento (janela de 30 min, comparando com `Order.paidAt` ou `paymentDetails.dateProcessed`; extrato em horário de Brasília, UTC-3) e nome semelhante (Dice por tokens, >= 0,6; primeiro+último nome iguais contam). Candidato com data aproximada (sem data registrada) nunca casa sozinho.
- Nome e horário batem com um único candidato mas o valor não: `AMOUNT_MISMATCH`. Mais de um candidato ou nome diferente: `UNMATCHED` com até 3 sugestões. Pix igual a um já conferido: `DUPLICATE_PAYMENT`.
- Pedido em grupo = um candidato (`Order`), nomes de todos os participantes aceitos. Candidatos de cartão (`captureMethod` de crédito) não casam com Pix.
- Direção inversa calculada na leitura (`findUncovered`): confirmadas no período sem linha vinculada; crédito aparece como "provável cartão". Estornadas ficam fora.
- Ações manuais: vincular (`RESOLVED_MANUAL`), "Não é inscrição" (`IGNORED`), desfazer; tudo registrado em `matchNote`.

### Arquivos
- Schema: `prisma/schema.prisma` (`StatementImport`, `StatementEntry`, `StatementEntryKind`, `MatchStatus`).
- Backend: `backend/utils/csvParser.ts`, `backend/services/audit/{statementParser,nameSimilarity,reconcile,candidates,auditService,routeHelpers}.ts`, `lib/infinitepay.ts` (`checkInfinitePayPayment`), `lib/permissions.ts`.
- Rotas: `app/api/admin/audit/{import,imports,imports/[id],entries/[id],payment-check}`.
- Frontend: `components/admin/financial/{AuditTab,auditTypes}`, `app/admin/financial/page.tsx`.
- Fixture sintética: `docs/melhorias-2.0/fixtures/extrato-infinitepay-sintetico.csv`. Verificação executável: `npx tsx backend/services/audit/reconcile.check.ts` (opcional `AUDIT_REAL_SAMPLE=<csv>` imprime só contagens).

### Testes realizados
- Verificação da função pura: conferido, centavo extra, nome diferente (sugestão), dois candidatos iguais (sugestão), grupo, duplicidade, movimentações, direção inversa, cartão fora do Pix, data aproximada.
- Amostra real: 69 linhas lidas (60 Pix recebido, 2 Pix enviado, 7 depósitos), 69 ids únicos.
- API local com a fixture: importação (3 conferidos, 1 divergente, 5 pendentes, 1 duplicidade, 2 movimentações), reimportação (12 `DUPLICATE`), CSV inválido e arquivo não .csv rejeitados sem importar nada, vincular/ignorar/desfazer, vínculo duplicado (409), `payment_check` com gateway mockado, 403 para CHECKIN/SUPPORT, 401 sem login. Dados de teste removidos.

### Pendências
- Validação visual (mobile) da aba e conferência com inscrições reais; `db push` no Supabase (aditivo) no deploy.
- Pix manual (`MANUAL`) não entra como candidato (sem horário de pagamento); aparece como "sem inscrição correspondente"; o vínculo manual a Pix manual ainda não é suportado.
- Relatório de Vendas com NSU (cartão) continua como evolução futura.

## Amostra real recebida (2026-11-11)

Arquivo exportado pelo Ricardo do painel InfinitePay (extrato de movimentações da conta), período 01/07/2026 a 22/07/2026, 69 linhas. **O arquivo real não entra no repositório** (contém nomes de pagadores); a fixture de teste deve ser sintética.

- Formato: CSV UTF-8, separador `,`, cabeçalho `Data,Hora,Tipo de transação,Nome,Detalhe,Valor`.
- `Data` em `AAAA-MM-DD`; `Hora` em `HH:MM:SS`; `Valor` como `+R$ 30,00` / `-R$ 2.615,00` (sinal, prefixo `R$`, milhar com ponto, decimal com vírgula).
- Tipos encontrados: `Pix` (62; `Detalhe` = `Recebido` ou `Enviado`) e `Depósito de vendas` (7; `Detalhe` = `Depósito InfinitePay`).
- `Nome` = nome do pagador (Pix recebido) ou do destinatário (Pix enviado).
- **Não há NSU/código de transação.** O casamento com inscrições precisa ser por valor + data/hora + similaridade de nome do pagador, com sugestão para revisão manual.
- Pagamentos com cartão aparecem só agregados em `Depósito de vendas`; não dá para conciliar cartão linha a linha com este arquivo. Se o painel tiver um relatório de **Vendas** com NSU, ele complementa a auditoria de cartão.
- Valores com centavo extra (`R$ 30,01`, `R$ 60,01`, `R$ 90,02`) aparecem em alguns Pix; tratar como tolerância de até R$ 0,05 no casamento.
- `Pix Enviado` (saídas) e `Depósito de vendas` não são recebimentos de inscrição: classificar como "movimentação da conta", fora da conciliação.

## Conferência com o extrato real (2026-11-11, só leitura em produção)

Rodada da função `reconcile` com a amostra real contra as inscrições InfinitePay de produção (sem gravar nada):

- 1ª regra (valor + janela de 30 min + nome semelhante): 31 dos 60 Pix recebidos conferidos, 24 pendentes e 5 falsas "duplicidades".
- Nos 31 conferidos, o horário do extrato e o do webhook coincidem **no mesmo minuto**. Nos pendentes, quase sempre existe uma única inscrição com o mesmo valor no mesmo minuto, paga por outra pessoa (pai/mãe, cônjuge), por isso o nome não batia.
- Regra revisada: valor igual + horário no mesmo minuto (janela `exactTimeWindowMinutes`, padrão 2 min) + **um único** candidato → conferido, com a nota "Pago por outra pessoa" quando o nome difere. Fora disso, continua sugestão para vínculo manual. Verificações em `reconcile.check.ts` atualizadas.
- Medição com a regra revisada (2026-11-11, só leitura): 57 dos 60 Pix recebidos conferidos automaticamente. Sobram 3 para revisão manual: um Pix de R$ 90,00 sem inscrição de mesmo valor e dois de R$ 30,00 cujos candidatos já foram usados (prováveis pagamentos de inscrições manuais). As 6 inscrições confirmadas sem recebimento no extrato são todas de cartão, como esperado. Desempate final: entre candidatos na janela de 2 min, vale o único no mesmo minuto.
- Inscrições confirmadas por InfinitePay em produção no período: 67 (58 Pix, 7 cartão, 2 sem método registrado); as de cartão aparecem como "Provável cartão".
