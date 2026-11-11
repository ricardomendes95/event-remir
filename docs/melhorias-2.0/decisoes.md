# Decisões arquiteturais (ADRs simplificados)

Formato: número, data, status (`proposta` | `aceita` | `rejeitada` | `substituída`), contexto, decisão, consequências. Decisões só passam a `aceita` com aprovação do Ricardo.

---

## ADR-001 — Modelo de pedido/pagamento (Order) desacoplado de Registration

- **Status**: aceita (aprovada pelo Ricardo em 2026-11-11)
- **Data**: 2026-07-22 (esboço) · 2026-07-24 (detalhamento)
- **Contexto**: Hoje o pagamento vive dentro de `Registration` (`paymentId`, `paymentError`, `paymentDetails` JSON) e a conciliação InfinitePay usa `order_nsu = registration.id` — relação 1:1 entre pagamento e inscrição. Quatro requisitos quebram essa premissa:
  - Req. 2 (inscrição em lote): 1 pagamento → N inscrições.
  - Req. 5 (compra posterior da camisa): 1 inscrição → N pagamentos (inscrição + camisa depois).
  - Req. 6 (auditoria): precisa da transação como entidade consultável (transaction_nsu, slug do invoice, link, status, valor, data) — hoje isso está espalhado em JSON.
  - Req. 12 (estorno): estorno é operação sobre a transação/pedido, não sobre a inscrição.

  O RFC pré-existente `docs/RFC_INSCRICAO_EM_LOTE.md` (rev. 2) já analisou 5 alternativas de modelagem para o req. 2 e escolheu a entidade `Order` 1:N com `Registration` (alternativa B), com `order_nsu` prefixado (`"ord_" + order.id`) e caminho legado intocado. **Este ADR adota essa escolha como base** e a estende para cobrir também os reqs. 5, 6 e 12.

- **Decisão (proposta)**:
  1. **Model `Order`** conforme o RFC de lote, com os campos: `id`, `eventId`, `status` (reusa enum `RegistrationStatus`), `paymentMethod`, `paymentId`, `paymentError`, `paymentDetails Json` (breakdown do gateway + `history[]` de eventos), `totalValue`, timestamps — **mais** os campos abaixo que o RFC não previa:
     - `type` enum novo `OrderType`: `REGISTRATION` (pedido de 1 inscrição avulsa, uso futuro/opcional), `BATCH` (lote de inscrições — req. 2), `SHIRT_ONLY` (camisa avulsa — req. 5).
     - Identificadores do gateway **em colunas tipadas** para o req. 6 (auditoria consulta por eles; JSON não indexa bem): `transactionNsu String?`, `invoiceSlug String?`, `checkoutUrl String?`, `receiptUrl String?`, `amountCents Int?`, `paidAmountCents Int?`, `paidAt DateTime?`. O restante do payload do webhook continua em `paymentDetails`.
     - `targetRegistrationId String?` — usado **apenas** por `SHIRT_ONLY`: aponta a inscrição confirmada que está comprando a camisa. Necessário porque `Registration.orderId` significa "pedido que pagou a inscrição" e não pode representar um segundo pagamento da mesma inscrição (1 inscrição → N pedidos).
  2. **`Registration.orderId String?`** (FK opcional, aditiva) — pedido que originou/pagou a inscrição. `null` para todo o histórico e para o fluxo individual atual, que **não muda**.
  3. **`order_nsu`**: fluxo individual continua `registration.id` (inclusive novas inscrições avulsas — sem backfill, sem migração); pedidos novos usam `"ord_" + order.id`; o webhook roteia por prefixo. Convivência permanente dos dois formatos, sem período de transição.
  4. **Sem backfill de dados históricos**: inscrições antigas permanecem como estão (`paymentDetails` JSON). A auditoria (req. 6) trata o formato legado na leitura (R-03).
  5. **Estorno (req. 12)** opera sobre `Order` quando existir e diretamente sobre `Registration` no formato legado; o registro do estorno em si (solicitação, motivo, status) é entidade própria definida no RFC do req. 12, não neste ADR.
- **Ordem de introdução**: o schema `Order` entra junto com a primeira melhoria que precisar dele (req. 2, 4ª do roadmap). Os reqs. 1 e 3 não dependem deste ADR.
- **Consequências**:
  - Webhook e `payments/status` ganham branch por prefixo — caminho legado bit a bit intocado (mitiga R-04).
  - Financeiro/auditoria passam a ter fonte consultável de transações novas; relatórios precisam somar os dois formatos (novo via `Order`, legado via `Registration.paymentDetails`).
  - `SHIRT_ONLY` confirmado atualiza `wantsShirt`/`shirtSize` da inscrição-alvo via webhook — o valor da camisa fica registrado no `Order`, preservando o histórico financeiro exigido pelo req. 5.
  - Mudança de schema aditiva (tabela nova + colunas novas opcionais) — segura para `db push` (R-02).
- **Alternativas consideradas**: (a) manter tudo em JSON `paymentDetails` — rejeitada: impossibilita consultas de auditoria/conciliação eficientes; (b) tabela só de auditoria sem refatorar o fluxo — resolveria o req. 6 mas não 2/5/12; (c) tabela de itens (`OrderItem`) N:N — mais genérica, porém complexidade desnecessária: os únicos dois casos reais (lote e camisa avulsa) são cobertos por `orderId` + `targetRegistrationId`; reavaliar se surgir um terceiro tipo de item; (d) demais alternativas de modelagem (pai/filho, payment compartilhado, batch sem entidade) já analisadas e descartadas na seção 6.1 do RFC de lote.

---

## ADR-002 — RBAC por enum + mapa estático de permissões (Edge-safe)

- **Status**: aceita (aprovada pelo Ricardo em 2026-07-22, via respostas às perguntas da sessão 2)
- **Data**: 2026-07-22
- **Contexto**: Req. 11 exige perfis Admin, Check-in e Suporte com permissões por rota E filtragem de campos financeiros. O enforcement acontece em dois lugares que não compartilham runtime livremente: `middleware.ts` (Edge) e controllers (Node). Já existia `SUPER_ADMIN | ADMIN` no enum `AdminRole`.
- **Decisão**:
  1. 4 perfis no enum Prisma: `SUPER_ADMIN` (tudo + gestão de usuários — exclusividade nova), `ADMIN` (tudo, exceto usuários), `CHECKIN`, `SUPPORT` (sem migração de dados; mudança aditiva).
  2. Mapa estático de permissões em `lib/permissions.ts` — módulo **sem dependências de Node** para ser importável do middleware Edge, dos controllers e do frontend. Fonte única: rota (prefixo + método HTTP) → roles permitidos.
  3. Default deny: rota protegida sem regra específica só é acessível a SUPER_ADMIN/ADMIN.
  4. SUPPORT vê método de pagamento mas nunca valores (filtragem de campos na serialização das rotas, não só bloqueio de rota). CHECKIN: `/checkin` + inscrições somente leitura sem valores.
  5. Dashboards simples por perfil nesta melhoria; dashboard rico fica para o req. 8.
- **Consequências**: gestão de usuários deixa de ser acessível a ADMIN comum (mudança de comportamento intencional); tabela de permissões no banco descartada por ora (3 perfis fixos não justificam a complexidade — reavaliar se surgirem permissões configuráveis).
- **Alternativas consideradas**: tabela de permissões no banco (flexível, porém mais complexa e exigiria fetch no middleware Edge a cada request); duplicar checagens hardcoded em cada rota (status quo, propenso a inconsistência — R-05).

---

## ADR-003 — Respostas em bloco às perguntas abertas dos RFCs

- **Status**: aceita (Ricardo, 2026-11-11: "concordo" com as recomendações dos RFCs)
- **Decisões**:
  - **Q5**: a contagem de vagas (global e por lote) passa a considerar só `PENDING` + `CONFIRMED`, corrigida na mesma entrega do req. 3.
  - **Q6**: a inscrição em lote entra com a Fase 6 do RFC (`leave-order` self-service).
  - **Q7**: cancelamento direto pelo admin gera `RefundRequest` de origem administrativa, para histórico.
  - **Q8**: "Solicitações de estorno" é página própria no menu admin.
  - **Q9**: estorno é exclusivo de `ADMIN`/`SUPER_ADMIN` na v1.
  - **Q11**: auditoria vive como aba "Auditoria" dentro do Financeiro.
  - **Q12**: `SUPPORT` pode imprimir o comprovante (documento público).
  - **Q13**: a receita da camisa é sempre `priceWithShirt − price` do lote/evento da inscrição.
  - **Q14**: compra posterior de camisa ganha prazo limite opcional (`shirtConfig.purchaseDeadline`).
  - **Q15**: o dashboard do admin abre no evento ativo mais recente, com seletor de evento.
  - **P-05**: o botão "Entrar em contato" usa o telefone do participante em E.164.
  - **P-03**: canal oficial `@ministerioremir3524` (já usado no site); a API key do YouTube é opcional — sem ela, a página de lives usa o fallback por embed.
  - **Q10/P-08**: a amostra do extrato CSV fica por último; o req. 6 é implementado depois de todos os outros.

