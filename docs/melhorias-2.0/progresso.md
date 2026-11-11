# Progresso da execução

Diário de trabalho, sessão a sessão, do mais recente para o mais antigo. Toda sessão deve terminar com uma entrada aqui dizendo **o que foi feito, onde parou e qual é o próximo passo**.

## Estado atual (resumo)

- **Fase**: implementação (sessão 4) — ver plano de ação de 2026-11-11.
- **Próximo passo**: seguir o plano de ação da sessão 4.
- **Bloqueios**: nenhum — P-06 resolvida em 2026-11-11 (enum aplicado no Supabase).

---

## 2026-11-11 — Sessão 4: plano de ação e execução das melhorias

**Decisões (Ricardo):** ADR-001 aceito; recomendações dos RFCs aceitas em bloco (ADR-003); executar tudo sem esperar aprovação a cada etapa, na ordem do roadmap, com a auditoria (req. 6) por último — antes dela, levantar a data do último evento em produção e ensinar a exportar o extrato.

**Plano de ação** (branch `feat/melhorias-2-0`, um commit por melhoria, schema aplicado só no banco local; produção recebe `db push` no deploy):

1. Req. 1 — cadastro e pagamentos
2. Req. 3 — lotes do evento (+ Q5)
3. Req. 2 — inscrição em lote (ADR-001, `Order`)
4. Req. 12 — cancelamento e estorno
5. Req. 9 — tela de inscrições
6. Req. 10 — financeiro
7. Req. 5 — compra posterior da camisa
8. Req. 4 — foto da camisa
9. Req. 8 — novo painel administrativo
10. Req. 7 — página de lives
11. Req. 6 — auditoria InfinitePay (depende da amostra de extrato)

---

## 2026-07-24 — Sessão 3: aprovação do req. 11 e início da fase de RFCs

**Decisões (Ricardo):**

- Req. 11 **aprovado** (P-01 também). P-06 permanece como pendência de deploy.
- Antes de qualquer implementação nova, **todas as melhorias devem ganhar RFC completo** com plano de ação, escrito no próprio arquivo `melhorias/XX-*.md` (fonte única — sem pasta separada de RFCs).
- Pesquisa web autorizada para fundamentar os RFCs 6/12 (documentação InfinitePay — P-04) e 7 (YouTube Data API).

**Feito:**

- Roadmap/pendências atualizados (req. 11 ✅, P-01 ✅).
- **P-04 resolvida** (pesquisa na doc oficial do InfinitePay): API pública tem só `POST /links`, `POST /payment_check` e webhook — **sem estorno e sem listagem de transações via API**. Direciona os RFCs 6 (importação de CSV do painel) e 12 (estorno manual assistido).
- **ADR-001 detalhado** em `decisoes.md` (model `Order` do RFC de lote + `type`/colunas tipadas/`targetRegistrationId` para cobrir reqs. 2, 5, 6 e 12) — status proposta, aguardando aprovação.
- **11 RFCs escritos** nos arquivos de `melhorias/` (todos com estado atual verificado no código, arquitetura, alternativas, riscos, plano e critérios de aceite): 01, 03, 02 (wrapper do RFC pré-existente `docs/RFC_INSCRICAO_EM_LOTE.md` rev. 2), 12, 06, 09, 10, 05, 04, 08, 07 (com análise de viabilidade YouTube concluída: API v3 + cache com fallback embed).
- Perguntas abertas Q1–Q15 registradas nos RFCs; P-08 criada (amostra de extrato CSV).
- Achados de código registrados nos RFCs: `POST/PUT /api/registrations` sem Zod e sem `withPrismaRetry` (corrigir no req. 1); contagem de vagas inclui `CANCELLED` (Q5); `ManualRegistrationSchema` órfão.

**Decisões adicionais (Ricardo, mesma sessão, via perguntas dinâmicas):** Q1 ✅ campo próprio `cashResponsible`; Q2 ✅ observação p/ ADMIN+SUPPORT (CHECKIN não); Q3 ✅ `priceWithShirt` por lote; Q4 ✅ virada de lote cobra preço do lote atual.

**Próximo passo:** Ricardo revisa e aprova os RFCs + ADR-001 e responde as perguntas restantes (Q5–Q15, P-03, P-08). Só então começa a implementação do req. 1 (Q1/Q2 já decididas — pronto para iniciar assim que aprovado).

---

## 2026-07-22 — Sessão 2: implementação do requisito 11 (controle de permissões)

**Decisões (Ricardo, via perguntas dinâmicas):** 4 perfis (SUPER_ADMIN acima, gestão de usuários exclusiva dele — ADMIN perdeu esse acesso intencionalmente); SUPPORT vê método de pagamento mas nunca valores; CHECKIN acessa `/checkin` + inscrições somente leitura sem valores; dashboards simples por perfil já nesta melhoria. Registrado como **ADR-002** (aceita).

**Feito:**

- `lib/permissions.ts` criado (fonte única Edge-safe de roles/matriz de permissões) e adotado por middleware, controllers e frontend.
- Enum `AdminRole` += `CHECKIN`/`SUPPORT` (aplicado **só no banco local** — P-06 para o Supabase).
- Enforcement em duas camadas (middleware por rota×método×role + guards nos controllers) e sanitização de campos financeiros nas rotas de inscrições/stats/dashboard.
- Frontend: redirect pós-login por perfil, dashboard condicional, tela de inscrições com `showValues`/`readOnly`, gestão de usuários com 4 perfis.
- Lista completa de arquivos em `melhorias/11-controle-permissoes.md`.
- Testes: matriz de autorização 33/33 PASS contra servidor local (script no scratchpad; usuários de teste `super|checkin|suporte@test.com` / `test123` no banco local).

**Descoberta:** `.env.local` aponta para o Supabase e tem prioridade no Next — registrado como P-07.

**Próximo passo:** aguardar aprovação do req. 11; depois req. 1 (ordem do roadmap).

---

## 2026-07-22 — Sessão 1: criação da estrutura de documentação

**Feito:**

- Análise dos 12 requisitos de `requisitos.md`.
- Criada a estrutura da pasta `/docs/melhorias-2.0/` (README, roadmap, progresso, decisões, riscos, pendências, testes e 12 arquivos de melhoria).
- Cada arquivo de melhoria recebeu análise preliminar fundamentada no código atual (schema Prisma, controllers, middleware, fluxo InfinitePay).
- Identificada dependência transversal (ADR-001, pendente): ausência de entidade de pedido/pagamento afeta os requisitos 2, 5, 6 e 12 — registrada em `roadmap.md` e `decisoes.md`.
- Roadmap segue a ordem sugerida no final de `requisitos.md`.

**Não feito / não iniciado:** nenhuma implementação de código.

**Próximo passo:** aguardar aprovação da estrutura; depois iniciar análise técnica completa do requisito 11 (controle de permissões), preenchendo `melhorias/11-controle-permissoes.md`.
