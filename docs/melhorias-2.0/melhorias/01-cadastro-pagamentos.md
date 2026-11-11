# Requisito 1 — Cadastro de participantes e pagamentos

- **Status**: ✅ Implementado (aguardando aprovação do Ricardo)
- **Ordem no roadmap**: 2ª
- **Requisito original**: `../requisitos.md` (item 1)
- **RFC escrito em**: 2026-07-24

## Objetivo e escopo

Melhorar o controle de inscrições manuais e do financeiro:

1. Campo **Observação** administrativa na inscrição (ex.: "pagou em espécie, dinheiro com a irmã Fulana").
2. Origem da inscrição claramente distinguida: **InfinitePay** (site) vs **Manual** — já existe no select do modal; o que falta é o detalhamento do manual.
3. Para inscrição **Manual**: sub-método de pagamento (**PIX | Dinheiro | Cartão**) + observação.
4. No **financeiro**: pagamento em espécie destacado, observação visível, responsável pelo dinheiro identificável.

**Fora de escopo**: entidade de pedido (`Order`, ADR-001 — só entra no req. 2); alterações no fluxo público de inscrição; redesenho da tela de inscrições (req. 9) e do financeiro como prestação de contas (req. 10) — este RFC só garante que os dados novos existam e apareçam nas telas atuais.

## Estado atual do código (verificado em 2026-07-24)

- `prisma/schema.prisma` — `Registration` não tem observação nem sub-método; `paymentMethod` é enum `MERCADO_PAGO | INFINITE_PAY | MANUAL | FREE` com **default `MERCADO_PAGO`** (herança perigosa: qualquer create que esqueça o campo grava método legado).
- `components/admin/registrations/RegistrationModal.tsx` — modal de criação/edição manual; select de método já mostra só `INFINITE_PAY | MANUAL` (aceita `MERCADO_PAGO` no Zod local apenas para editar históricos); já respeita `showValues` (ADR-002).
- `app/api/registrations/route.ts` (POST) — criação manual **sem validação Zod** (destructuring direto do body) e **sem `withPrismaRetry`**; grava `paymentId: "manual_<timestamp>_<rand>"`.
- `app/api/registrations/[id]/route.ts` (PUT) — edição também sem Zod e sem retry.
- `backend/schemas/registrationSchemas.ts` — `ManualRegistrationSchema` (com `paymentType: pix|credit_card|manual` e `amountPaid`) **existe mas está órfão**: nenhuma rota o importa. Não reaproveitar como está — os valores do enum não batem com o requisito (falta Dinheiro).
- `backend/utils/registrationSerializer.ts` — sanitização por perfil (ADR-002): CHECKIN/SUPPORT não veem `paymentId/paymentError/paymentDetails/event.price`. SUPPORT **vê** `paymentMethod`.
- Financeiro: `app/api/admin/financial/route.ts` agrega por `paymentMethod` (InfinitePay × Manual), `app/admin/financial/page.tsx` exibe e exporta CSV. `app/api/registrations/stats/route.ts` calcula receita via `resolveBaseValue`.

## Decisões de produto/UX

- Select de origem permanece `InfinitePay | Manual` (como o requisito pede). `MERCADO_PAGO`/`FREE` continuam apenas como dados históricos/fluxo gratuito.
- Quando **Manual** for selecionado no modal: aparecem o select "Método de pagamento" (PIX | Dinheiro | Cartão, obrigatório) e o campo "Observação" (opcional, textarea).
- **Observação é visível para qualquer origem** (não só Manual) — é um campo administrativo geral, como pede o requisito ("qualquer observação administrativa").
- Quando o método manual for **Dinheiro**: campo adicional "Responsável pelo dinheiro" (texto livre, opcional) — ver pergunta aberta Q1.
- Observação **não** aparece em nenhuma rota/tela pública (comprovante, busca por CPF) — é dado administrativo (regra 11 do `08_AI_RULES.md`).
- SUPPORT e CHECKIN podem ver a observação (não é valor financeiro); ver pergunta aberta Q2.

## Arquitetura proposta

### Schema (aditivo, seguro para `db push` — R-02)

```prisma
model Registration {
  // ...campos atuais...
  notes             String?            @db.Text   // observação administrativa
  manualPaymentType ManualPaymentType?            // só quando paymentMethod = MANUAL
  cashResponsible   String?                       // só quando manualPaymentType = CASH (Q1)
}

enum ManualPaymentType {
  PIX
  CASH
  CARD
}
```

**Campos tipados, não JSON** (decisão D1 abaixo). Aproveitar a mudança para **remover o default `MERCADO_PAGO`** de `paymentMethod` (todos os fluxos existentes já setam o campo explicitamente — verificado em create-preference, create-free, webhook, POST /api/registrations); o `db push` não altera dados existentes.

### Backend

- Criar **schema Zod real** para criação/edição manual em `backend/schemas/registrationSchemas.ts` (substituindo o órfão `ManualRegistrationSchema`): campos atuais + `notes`, `manualPaymentType`, `cashResponsible`, com regra condicional — `manualPaymentType` obrigatório se `paymentMethod = MANUAL`, proibido caso contrário; `cashResponsible` só com `CASH`.
- Aplicar o schema no `POST /api/registrations` e `PUT /api/registrations/[id]` (corrige de passagem a ausência de validação; envelope de resposta preservado) e envolver as operações Prisma dessas rotas com `withPrismaRetry` (corrige violação da regra dura 1 — hoje o POST/PUT não usam).
- `registrationSerializer`: `notes`/`manualPaymentType`/`cashResponsible` **não** são valores financeiros — permanecem visíveis para SUPPORT/CHECKIN (confirmar em Q2).
- Rotas públicas (comprovante/busca por CPF): garantir que `notes`, `cashResponsible` e `manualPaymentType` **não** sejam serializados.

### Frontend

- `RegistrationModal.tsx`: renderização condicional — `paymentMethod === "MANUAL"` → select método (PIX/Dinheiro/Cartão) obrigatório; método `CASH` → campo "Responsável pelo dinheiro"; textarea "Observação" sempre visível (com contador, limite ~500).
- `RegistrationTable.tsx`: badge do método manual na coluna de pagamento (ex.: tag "Dinheiro" em amarelo com tooltip da observação); ícone/indicador quando há observação.
- Financeiro (`app/admin/financial/page.tsx` + `app/api/admin/financial/route.ts`): quebra do "Manual" por sub-método (PIX/Dinheiro/Cartão); nas linhas de Dinheiro, exibir responsável e observação; incluir os campos novos na exportação CSV.
- `app/api/registrations/stats/route.ts`: sem mudança de cálculo (receita continua por `resolveBaseValue`); nada a fazer além de conferir que não quebra.

## Alternativas consideradas

- **D1 — Campos tipados vs `paymentDetails` JSON**: tipados **escolhido**. O financeiro precisa agrupar/filtrar por sub-método ("quanto entrou em dinheiro?") e o JSON tornaria isso caro e frágil; mudança de schema é aditiva e segura. JSON continuará sendo usado apenas para payloads de gateway.
- **Reaproveitar `ManualRegistrationSchema`**: descartado — está órfão, tem valores incompatíveis (`credit_card`/`manual`, sem dinheiro) e um `amountPaid` que violaria a regra de valor recalculado no servidor. Será removido/substituído.
- **Sub-método como valores novos no enum `PaymentMethod`** (ex.: `MANUAL_PIX`, `MANUAL_CASH`): descartado — quebraria todos os filtros existentes que assumem `MANUAL`, e mistura dois conceitos (origem × instrumento).

## Riscos e mitigação

- **R-03 (dados legados)**: inscrições manuais antigas ficarão com `manualPaymentType = null` — todas as telas exibem "Manual (não informado)" nesse caso; nenhum backfill.
- **Remoção do default `MERCADO_PAGO`**: risco de algum create não mapeado falhar em runtime — mitigado por `npx tsc --noEmit` (o client Prisma passa a exigir o campo) e busca por `registration.create` no repo.
- **R-02 (`db push`)**: mudança 100% aditiva + P-07 (conferir a URL de banco ativa antes de rodar).
- Observação com dado pessoal em tela: campo é livre — orientar no placeholder ("não registre dados sensíveis desnecessários").

## Perguntas abertas — **respondidas (Ricardo, 2026-07-24)**

- **Q1 ✅**: "Responsável pelo dinheiro" será **campo dedicado** (`cashResponsible`), exibido só quando método = Dinheiro; financeiro lista responsáveis.
- **Q2 ✅**: observação visível para **ADMIN/SUPER_ADMIN + SUPPORT** (que também escreve); **CHECKIN não vê** — ajustar o serializer de acordo.

## Plano de implementação

1. Schema Prisma: `notes`, `manualPaymentType` (+enum), `cashResponsible` (se Q1 aprovado); remover default de `paymentMethod`; `npm run db:push` (local primeiro — P-07).
2. Zod: novo schema de inscrição manual em `backend/schemas/registrationSchemas.ts`; remover `ManualRegistrationSchema` órfão (e `backend/types/registration.ts` se ficar sem uso).
3. Backend: aplicar Zod + `withPrismaRetry` em `POST /api/registrations` e `PUT /api/registrations/[id]`; conferir serialização pública.
4. Frontend modal: campos condicionais no `RegistrationModal.tsx`.
5. Frontend listagem: badges/tooltip em `RegistrationTable.tsx`.
6. Financeiro: quebra por sub-método em `app/api/admin/financial/route.ts` + cards/tabela/CSV em `app/admin/financial/page.tsx`.
7. Verificação: `npx tsc --noEmit`, `npm run lint`, `npm run build` + matriz de testes abaixo.
8. Documentação: atualizar `docs/FLUXO_INSCRICAO.md` (seção admin) e este arquivo.

## Critérios de aceite / testes manuais

- Criar inscrição manual PIX, Dinheiro (com responsável) e Cartão → dados persistidos e exibidos na tabela e no financeiro.
- Criar inscrição manual sem método → 422 com `errors[]`.
- Editar inscrição histórica (`MERCADO_PAGO`) → continua renderizando sem erro; sub-método opcionalmente preenchível? (não: só para MANUAL).
- Inscrição via site (InfinitePay) → sem campos manuais, observação editável depois pelo admin.
- Comprovante público/busca por CPF → **não** expõe observação/responsável.
- Perfil SUPPORT → vê método manual e observação, não vê valores; CHECKIN → somente leitura.
- Financeiro → total em espécie destacado + responsáveis listados; CSV com colunas novas.
- Mobile: modal utilizável em viewport 375px.

## Checklist

- [x] Análise técnica completa (2026-07-24)
- [x] Decisão: campos tipados vs `paymentDetails` JSON → **tipados** (D1)
- [x] Q1/Q2 respondidas pelo Ricardo (2026-07-24: campo próprio; ADMIN+SUPPORT)
- [x] Alteração de schema + `db push`
- [x] Backend (schemas Zod, rotas com retry)
- [x] Frontend (form manual, tabelas, financeiro)
- [x] Exportações/relatórios atualizados
- [x] Testes (rotas via curl no banco local; UI não testada em navegador)
- [x] Documentação atualizada
- [ ] Aprovação do Ricardo

## Progresso / Arquivos alterados / Testes realizados / Pendências

**Arquivos alterados**: `prisma/schema.prisma`, `backend/schemas/registrationSchemas.ts`, `backend/utils/validationResponse.ts` (novo), `backend/utils/registrationSerializer.ts`, `backend/types/registration.ts` (removido, sem uso) e `backend/types/index.ts`, `lib/permissions.ts` (`canViewRegistrationNotes`), `app/api/registrations/route.ts`, `app/api/registrations/[id]/route.ts`, `app/api/admin/financial/route.ts`, `app/admin/registrations/page.tsx`, `app/admin/financial/page.tsx`, `components/admin/registrations/RegistrationModal.tsx` e `RegistrationTable.tsx`, `docs/FLUXO_INSCRICAO.md`, `docs/contexto-ia/04_COMPONENT_LIBRARY.md`.

**Implementação**: `db push` aplicado só no Postgres local; default de `paymentMethod` removido (create-preference, create-free, POST /api/registrations e `/api/admin/registrations/manual` já setam o campo). Zod `AdminRegistrationCreateSchema`/`AdminRegistrationUpdateSchema` (substituem o `ManualRegistrationSchema` órfão), com 422 + `errors[]`. No PUT o estado final (enviado + salvo) é validado na rota e só quando o envio toca no pagamento; trocar a origem para não-Manual limpa sub-método/responsável. `withPrismaRetry` em todas as operações Prisma de POST/GET/PUT/DELETE de `/api/registrations` e no financeiro. Serializer: CHECKIN recebe `notes`/`cashResponsible` nulos (SUPPORT e acima veem). Rotas públicas (`get-by-id`, `search-by-cpf`) usam seleção explícita de campos e não expõem os novos.

**Testes realizados** (servidor local na porta 3111, banco local): POST Manual sem método → 422 com `errors[]`; POST Dinheiro com responsável e observação → 200; responsável com PIX, tipo manual com InfinitePay e observação com 501 caracteres → 422; PUT só de status em manual → 200; PUT PIX limpa responsável; PUT para InfinitePay limpa sub-método; GET como CHECKIN → `notes`/`cashResponsible` nulos; GET como SUPPORT → vê os campos e `paymentId` nulo; PUT como CHECKIN → 403; `get-by-id` público sem os campos; `/api/admin/financial` com `manualBreakdown` e `cashResponsibles`. `npx tsc --noEmit`, `npm run lint` (só avisos antigos) e `npm run build` limpos.

**Pendências**: validação visual do modal em 375px e da tabela/financeiro em navegador; `app/api/admin/registrations/manual/route.ts` (sem uso na UI) continua criando Manual sem sub-método (aparece como "Manual (não informado)"); `RegistrationStats`/exportações de lista (`export-admin`, impressão) não incluem os campos novos.
