# Requisito 3 — Sistema de lotes do evento

- **Status**: 🔍 RFC pronto (aguardando aprovação)
- **Ordem no roadmap**: 3ª
- **Requisito original**: `../requisitos.md` (item 3)
- **RFC escrito em**: 2026-07-24

## Objetivo e escopo

Suportar lotes de inscrição (1º/2º/3º lote…), cada um com **nome, período, quantidade de vagas, prioridade e preço próprio**. A inscrição obedece ao **lote ativo**, resolvido sempre no servidor.

> Vocabulário: este "lote" (tier de preço) ≠ "inscrição em lote" do req. 2 (bulk). No código: **`EventBatch`**.

**Fora de escopo**: alterar a mecânica de camisa (segue `shirtConfig`, só o preço passa a poder variar por lote); fila de espera; lote "virtual" por quantidade sem período.

## Estado atual do código (verificado em 2026-07-24)

- `Event` tem `price Float` único, `registrationStartDate/EndDate` e `maxParticipants` globais.
- Preço é sempre recalculado no servidor: `resolveBaseValue(event, wantsShirt)` em `backend/utils/shirtPricing.ts` — usado por `create-preference`, webhook (conferência de valor), `stats` e financeiro.
- `shirtConfig.priceWithShirt` é **valor absoluto** (não um acréscimo), validado como `> price` em `backend/schemas/eventSchemas.ts`.
- Gates de disponibilidade em `app/api/payments/create-preference/route.ts`: `isActive`, janela de inscrição, `event._count.registrations >= maxParticipants`. **Achado**: essa contagem inclui inscrições `CANCELLED`/`PAYMENT_FAILED` — vaga cancelada nunca é liberada (bug preexistente, ver Riscos).
- `app/api/events/active/route.ts` expõe o evento público (`capacity: maxParticipants`).
- Admin: `components/admin/EventModal.tsx` já usa `Form.List` (tamanhos de camisa) — padrão a reaproveitar para a lista de lotes.

## Decisões de produto/UX

- Evento **sem lotes continua funcionando exatamente como hoje** (preço único) — lotes são opcionais por evento.
- Público vê o lote vigente de forma simples: "1º lote — R$ 90 (até 15/08 ou enquanto houver vagas)". Sem tabela de lotes futuros na primeira versão (reduz ruído; pode entrar depois).
- Lote esgotado (vagas) ou expirado (período) → próximo lote pela **prioridade** (menor número primeiro). Nenhum lote vigente → inscrições fechadas com mensagem clara.
- Admin gerencia lotes dentro do próprio `EventModal` (seção "Lotes"), sem tela nova.

## Arquitetura proposta

### Schema (aditivo)

```prisma
model EventBatch {
  id             String   @id @default(cuid())
  eventId        String
  event          Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  name           String                    // "1º Lote"
  startDate      DateTime
  endDate        DateTime
  quota          Int?                      // vagas do lote; null = limitado só pelo maxParticipants
  priority       Int      @default(0)     // menor = usado primeiro em caso de vigência simultânea
  price          Float
  priceWithShirt Float?                   // obrigatório se o evento tem camisa habilitada (Q3)
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  registrations  Registration[]

  @@index([eventId])
  @@map("event_batches")
}

model Registration {
  // ...campos atuais...
  batchId String?
  batch   EventBatch? @relation(fields: [batchId], references: [id])
}
```

`Registration.batchId` registra em qual lote a inscrição foi feita (histórico/financeiro por lote — insumo do req. 10). Nullable → dados históricos e eventos sem lote ficam `null`.

### Resolução do lote ativo (fonte única)

Novo `backend/utils/eventBatches.ts`:

- `resolveActiveBatch(event, batches, countsByBatch, now)`: filtra `isActive` + período vigente + (sem `quota` ou vagas restantes > 0), ordena por `priority`, retorna o primeiro (ou `null`).
- Vagas do lote contam inscrições `PENDING` + `CONFIRMED` do `batchId` (não CANCELLED/PAYMENT_FAILED).
- `resolveBaseValue` ganha variante batch-aware: `resolveBaseValue(event, wantsShirt, batch?)` — com lote, usa `batch.price`/`batch.priceWithShirt`; sem lote, comportamento atual intocado (chamadores existentes não mudam de assinatura obrigatória).

Pontos de uso: `create-preference` (resolve lote ativo → grava `batchId` → cobra preço do lote), webhook (confere valor usando o **lote registrado na inscrição**, não o vigente no momento do webhook), `events/active`/`by-slug` (expõe lote vigente), admin manual (`POST /api/registrations` — atribui lote ativo; admin pode sobrescrever? não na v1).

### CRUD de lotes

Gerenciado dentro do update/create do evento (`EventController`): payload ganha `batches: BatchInput[]`, validado por Zod (`EventBatchSchema`) e sincronizado em transação (upsert/delete por id). Regras de validação:

- Períodos dentro da janela de inscrição do evento (aviso, não bloqueio — janela pode ser ajustada depois).
- `priceWithShirt > price` quando camisa habilitada (mesma regra do evento).
- Soma de `quota`s pode exceder `maxParticipants` (o teto global sempre prevalece) — documentar no admin.
- Sobreposição de períodos é permitida (é para isso que serve `priority`).

### Frontend

- `EventModal.tsx`: seção "Lotes" com `Form.List` — nome, período (RangePicker), vagas (opcional), prioridade, preço, preço com camisa (se camisa habilitada).
- Página pública do evento + `EventRegistrationModal`: preço vem do lote ativo exposto pela API (`activeBatch`); etapa de pagamento mostra nome do lote.
- Tela de inscrições/financeiro: coluna/filtro por lote (mínimo viável; relatório completo por lote fica no req. 10).

## Alternativas consideradas

- **Preço da camisa como acréscimo fixo (delta) por evento** em vez de `priceWithShirt` por lote: menos campos, mas quebra o modelo mental já existente do admin (hoje ele digita o valor absoluto "com camisa") e impede promoções tipo "camisa mais barata no 1º lote". **Escolhido: `priceWithShirt` por lote** (Q3 confirma).
- **Lote como faixas de quantidade sem período** ("primeiras 50 inscrições"): o requisito pede período explicitamente; `quota` já cobre o híbrido.
- **CRUD de lotes em rotas próprias** (`/api/admin/events/[id]/batches`): mais REST, porém mais superfície de middleware/permissões para um dado que só vive dentro do formulário do evento. Escolhido: embutido no save do evento, transacional.
- **Tabela `PriceTier` genérica multi-produto**: overengineering — só eventos têm preço aqui.

## Riscos e mitigação

- **Corrida na última vaga do lote** (duas inscrições simultâneas): mesma classe de corrida que já existe hoje no `maxParticipants` global (sem `$transaction`/lock — registrado na seção 17 do RFC de lote do req. 2). Mitigação na v1: contagem transacional (`$transaction` leitura+create) ao criar inscrição com lote; lock definitivo entra junto com o req. 2, que introduz esse padrão.
- **Contagem atual inclui CANCELLED** (achado novo): decidir se a contagem de lote nasce correta (PENDING+CONFIRMED — recomendado) e se corrigimos o global na mesma entrega → registrado como pergunta Q5 e candidato a débito em `../../contexto-ia/09_DECISOES_E_DEBITOS.md`.
- **PENDING que atravessa a virada de lote** segurando vaga/preço → Q4.
- **R-03**: inscrições históricas sem `batchId` — telas exibem "—" e relatórios agrupam como "Sem lote".
- **R-02**: mudança aditiva; conferir P-07 antes do `db push`.

## Perguntas abertas

- **Q3 ✅ (Ricardo, 2026-07-24)**: preço com camisa **por lote** (`priceWithShirt` no `EventBatch`).
- **Q4 ✅ (Ricardo, 2026-07-24)**: ao "continuar pagamento" após virada de lote, cobra o **preço do lote atual** (o `batchId` da inscrição é atualizado no novo checkout).
- **Q5** (pendente): corrigir na mesma entrega a contagem global de vagas para excluir `CANCELLED`/`PAYMENT_FAILED` (recomendado) ou registrar como débito separado?

## Plano de implementação

1. Schema: `EventBatch` + `Registration.batchId` → `db push` local.
2. `backend/utils/eventBatches.ts` (resolveActiveBatch + resolveBaseValue batch-aware) — funções puras.
3. Zod `EventBatchSchema` em `backend/schemas/eventSchemas.ts` + sync transacional no `EventController`.
4. `create-preference` + `POST /api/registrations` (admin manual): resolver lote, gravar `batchId`, cobrar preço do lote, contar vaga do lote em `$transaction`.
5. Webhook: conferência de valor usando o lote da inscrição (`registration.batchId`).
6. APIs públicas (`events/active`, `by-slug`): expor `activeBatch` (nome, preços, fim do período). Nunca expor quotas/contagens detalhadas dos demais lotes.
7. Frontend admin: seção Lotes no `EventModal`.
8. Frontend público: preço/nome do lote no card do evento e no modal de inscrição.
9. `update-preference` (continuar pagamento): aplicar decisão da Q4.
10. Verificação (`tsc`/lint/build) + matriz abaixo; atualizar `docs/FLUXO_INSCRICAO.md` e este arquivo.

## Critérios de aceite / testes manuais

- Evento sem lotes: fluxo idêntico ao atual (regressão zero) — pago e gratuito.
- Evento com 3 lotes: inscrição no período do 1º cobra preço do 1º; virada por data e por esgotamento de vagas muda preço/nome exibidos e cobrados.
- Dois lotes vigentes simultâneos → vence o de menor `priority`.
- Nenhum lote vigente → "inscrições encerradas" na página pública e 400 no create-preference.
- Camisa: preço com camisa do lote correto no modal, no checkout e na conferência do webhook.
- Continuar pagamento cruzando virada de lote → comportamento da Q4.
- Tentativa de adulterar preço no client → servidor recalcula pelo lote.
- Inscrição manual (admin) → recebe `batchId` do lote vigente.
- Mobile: seção de lotes no admin utilizável; página pública clara.

## Checklist

- [x] Análise técnica completa (2026-07-24)
- [x] Decisão de nomenclatura (`EventBatch`) e regra de "lote ativo" (período + quota + priority, fonte única no servidor)
- [x] Q3/Q4 respondidas (2026-07-24: por lote; preço do lote atual) · [ ] Q5 pendente
- [ ] Schema (`EventBatch`, `Registration.batchId`) + `db push`
- [ ] Backend (serviço lote ativo, CRUD, create-preference, webhook)
- [ ] Frontend (admin de lotes, página pública, checkout)
- [ ] Retrocompatibilidade com eventos sem lote verificada
- [ ] Testes (ver `../testes.md`)
- [ ] Documentação atualizada
- [ ] Aprovação do Ricardo

## Progresso / Arquivos alterados / Testes realizados / Pendências

_(preencher durante a implementação)_
