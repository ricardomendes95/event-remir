# Requisito 2 — Inscrição em lote (várias inscrições, um pagamento)

- **Status**: 🚧 Backend implementado e testado localmente (2026-11-11); frontend pendente
- **Ordem no roadmap**: 4ª
- **Requisito original**: `../requisitos.md` (item 2)
- **RFC escrito em**: 2026-07-24

## Objetivo

Cadastrar vários participantes em um único processo, gerar **um só pagamento** e vincular todas as inscrições ao mesmo pedido.

## RFC de referência (não duplicar)

Este requisito **já possui RFC completo e revisado**: **`docs/RFC_INSCRICAO_EM_LOTE.md` (rev. 2)** + `docs/ANALISE_DE_VIABILIDADE_DA_FEATURE_DE_INSCRICAO_EM_LOTE.md` — adotados como especificação oficial desta melhoria (decisão P-04 do contexto-ia). Este arquivo é o **wrapper de execução**: registra o que o RFC decide, o que mudou desde que ele foi escrito, e o plano/checklist de entrega.

### Decisões do RFC que valem como especificação

- Modelo **`Order` 1:N `Registration`** (alternativa B; agora formalizado e estendido no **ADR-001** em `../decisoes.md` — o schema definitivo é o do ADR, que soma `type`, colunas tipadas de auditoria e `targetRegistrationId` ao model do RFC).
- `order_nsu` prefixado: `"ord_" + order.id`; roteamento no webhook por prefixo; caminho individual bit a bit intocado.
- UX **sem wizard**: checkbox "Inscrever mais pessoas nesta mesma compra" + quantidade + cards accordion no mesmo `EventRegistrationModal` (2 steps de hoje); termo oficial **"Responsável pela compra"**; `MAX_BATCH_SIZE = 10`.
- Endpoints novos: `create-batch-preference`, `create-free-batch`, `leave-order`, "continuar pagamento" de pedido; webhook estendido com salvaguarda de link obsoleto (seção 9.7 do RFC).
- Pedido pendente abandonado: **Opção C** (participante escolhe entre continuar o pagamento do grupo ou sair e se inscrever sozinho), com a Opção D (resolução manual pelo admin) como redução de escopo aceitável da 1ª entrega.
- `$transaction` com lock na checagem de vagas — pré-requisito, primeiro uso do padrão no projeto.
- Plano em 9 fases (0–8) com critérios de aceite por fase — seção "Plano de Implementação" do RFC.

## Atualizações desde a escrita do RFC (2026-07-24)

1. **ADR-001 estende o model `Order`** (tipo do pedido, colunas de auditoria, camisa avulsa) — implementar o schema do ADR já na Fase 0, para não alterar a tabela duas vezes.
2. **Interação com o req. 3 (lotes do evento)**, que não existia quando o RFC foi escrito e será implementado **antes** (3ª vs 4ª do roadmap):
   - O total do pedido soma `resolveBaseValue` **batch-aware** por participante (todos os participantes do lote-bulk usam o mesmo `EventBatch` vigente no momento da criação).
   - A reserva de vagas na `$transaction` precisa checar **as duas quotas**: `maxParticipants` global e `quota` do lote vigente (N vagas de uma vez).
   - A saída de participante (`leave-order`) recalcula o total usando o lote registrado nas inscrições remanescentes.
3. **Interação com o req. 1**: campo `notes` e afins não afetam o fluxo público — sem impacto.
4. **Permissões (req. 11, já entregue)**: os endpoints novos de lote são públicos (fluxo do participante) → entram em `publicRoutes` com justificativa; `leave-order` idem (mesma superfície da busca por CPF, conforme seção 14 do RFC).
5. **Questão em aberto do RFC ("InfinitePay permite invalidar link?")**: a pesquisa da P-04 (2026-07-24) confirmou que a API pública **não** oferece invalidação de link — seguir apenas com a salvaguarda da seção 9.7 (comparação de `transactionNsu`), como o RFC já previa para esse caso.

## Riscos (além dos do RFC)

- R-04: compatibilidade `order_nsu` legado obrigatória — coberta pelo prefixo.
- Sequenciamento: se o req. 3 atrasar, o lote-bulk pode ser entregue sem lotes de preço (fallback `event.price`) — o desenho não acopla os dois.

## Perguntas abertas

- **Q6**: a 1ª entrega inclui a Fase 6 do RFC (`leave-order` self-service) ou adotamos a Opção D (resolução manual pelo admin) e entregamos a Fase 6 na sequência? (Recomendação: incluir — o RFC mostra que a salvaguarda do webhook precisa existir de qualquer forma, e o custo incremental é conhecido.)

## Plano de implementação

Seguir as **Fases 0–8 do RFC** (`docs/RFC_INSCRICAO_EM_LOTE.md`, seção "Plano de Implementação"), com os ajustes acima:

- Fase 0 usa o schema do **ADR-001** (não o schema resumido do RFC).
- Fases 2/3 integram `resolveActiveBatch`/quota de lote (req. 3) na transação de vagas.
- Fase 4 (webhook) usa as colunas tipadas do ADR-001 ao persistir a confirmação.
- Fase 6 conforme Q6.
- Fase 8 (flag `Event.allowBatchRegistration`) mantida — rollout controlado.

## Critérios de aceite / testes

Matriz completa na seção 20 do RFC (unitários, integração, webhook, concorrência, E2E mobile). Somam-se: cenários com lote de preço vigente (total por lote, virada de lote durante preenchimento) e regressão do fluxo individual com e sem lote.

## Checklist

- [x] ADR-001 detalhado (proposta em `../decisoes.md`)
- [x] ADR-001 **aprovado pelo Ricardo** (2026-11-11)
- [x] Análise técnica completa (RFC rev. 2 + este wrapper)
- [x] Q6 respondida (incluir `leave-order`, ADR-003)
- [x] Schema (`Order` conforme ADR-001) + `db push` (só banco local)
- [x] Backend (create-batch-preference, create-free-batch, webhook, continuar pagamento, leave-order)
- [x] Frontend (extensão inline do modal, comprovante consolidado, alerta de grupo, toggle e indicação no admin)
- [x] Compatibilidade `order_nsu` legado verificada (webhook individual testado; ramo legado intocado)
- [~] Testes de backend e de frontend (desktop) feitos; E2E mobile real e `../testes.md` pendentes
- [x] Documentação atualizada (`docs/FLUXO_INSCRICAO.md`, `04_COMPONENT_LIBRARY.md`, RFC marcado como implementado)
- [ ] Aprovação do Ricardo

## Progresso / Arquivos alterados / Testes realizados / Pendências

### Progresso

Backend das Fases 0–4, 5 (continuar pagamento), 6 (`leave-order`) e 8 (flag) do RFC. Frontend (Fase 7) e toggle da flag no `EventModal` ficam para a próxima etapa. Sem commit.

**Desvios do RFC**

- **Salvaguarda 9.7**: o RFC compara `transactionNsu` do webhook com `Order.paymentId`, mas o `transaction_nsu` só existe depois do pagamento (não dá para gravá-lo ao criar o link). A comparação é feita com o **`amount` do webhook** (valor do link que geramos) contra o total atual recalculado: diferente → pedido não é confirmado, grava `stale_payment_received` em `paymentDetails.history[]` e responde 200. Sem `amount` no payload, vale `paymentId == null` (link invalidado por saída). `Order.paymentId` guarda o `order_nsu` do link vigente e vira `null` quando o link é invalidado.
- Confirmação usa o lote **gravado em cada inscrição** (como o webhook individual), não o vigente.
- Rota de continuar pagamento: `POST /api/payments/update-batch-preference` (nome do RFC). Só aceita pedido `PENDING` (o webhook InfinitePay nunca gera `PAYMENT_FAILED`).
- `Registration.order` sem `onDelete: Cascade` (o RFC previa Cascade): apagar um pedido não deve apagar inscrições; hoje nada apaga `Order` (só a exclusão do evento, que cascateia pelo `Event`).
- CPF com inscrição `PENDING` individual (sem pedido) também bloqueia o participante (409, `CPF_PENDING_INDIVIDUAL`); o RFC só previa "pendente em outro pedido". `CANCELLED`/`PAYMENT_FAILED` é reaproveitada (UPDATE), como no individual.
- Validação por participante extraída para `backend/services/registrationValidation.ts` (Fase 1); o fluxo individual **não** foi migrado para ela (não tocado de propósito).
- `create-preference`/`create-free` individuais seguem sem lock (só os endpoints de lote travam o evento). Isso significa que um individual concorrente com um lote ainda pode estourar a última vaga; retroaplicar o lock ao individual é melhoria independente.
- Respostas de erro das rotas novas seguem o envelope `{ success:false, error, errors? }`; as rotas individuais legadas continuam como estavam.

### Arquivos alterados

`prisma/schema.prisma` (`Order`, `OrderType`, `Registration.orderId`, `Event.allowBatchRegistration`); novos `backend/schemas/batchRegistrationSchemas.ts`, `backend/services/registrationValidation.ts`, `backend/services/batchRegistrationService.ts`; `backend/services/payment/infinitePayService.ts` (`createInfinitePayCheckoutForOrder`, helpers de `ord_`); `backend/services/eventBatchService.ts` (`countBatchOccupied`); `backend/utils/validationResponse.ts`; `backend/schemas/eventSchemas.ts` e `index.ts`; `backend/repositories/EventRepository.ts`; novas rotas `app/api/payments/create-batch-preference`, `app/api/payments/update-batch-preference`, `app/api/registrations/create-free-batch`, `app/api/registrations/[id]/leave-order`; editadas `app/api/payments/webhook/infinitepay`, `app/api/payments/status`, `app/api/registrations/get-by-id`, `app/api/registrations/search-by-cpf`, `app/api/events/{active,by-slug/[slug],list-active}` (expõem `allowBatchRegistration`); `middleware.ts` (rotas públicas); `types/event.ts`; docs (`FLUXO_INSCRICAO.md`, `00_PROJECT_CONTEXT.md`, este arquivo, `progresso.md`).

### Contrato das rotas para o frontend

Todas retornam `{ success, data | error, errors? }`. Erros por participante: `errors: [{ index, field, message, code? }]` (`index` = posição em `participants`; `field` relativo ao participante, ex. `cpf`, `shirtSize`, `dynamicFormData.<idDoCampo>`). `code`: `INVALID_FIELD`, `INVALID_CPF`, `CPF_DUPLICATED_IN_BATCH`, `CPF_ALREADY_REGISTERED`, `CPF_PENDING_INDIVIDUAL`, `CPF_IN_OTHER_ORDER`. Valores nunca vêm do cliente. CPF pode ir formatado (o servidor normaliza). Máximo de 10 participantes; o 1º é o Responsável pela compra.

- `POST /api/payments/create-batch-preference` (público) — body: `{ eventId, participants: [{ name, email, cpf, phone, wantsShirt?, shirtSize?, dynamicFormData? }] }`.
  - 201: `{ success:true, data:{ gateway:"INFINITE_PAY", orderId, checkoutUrl, totalValue, batchName|null, registrations:[{ id, name, value }] } }` (redirecionar para `checkoutUrl`).
  - 422 validação (inclui CPF repetido no lote) · 409 CPF já inscrito/pendente, vagas insuficientes (global ou do lote), lotado · 403 flag `allowBatchRegistration` desligada · 400 evento inativo/gratuito/fora da janela/sem lote vigente · 404 evento · 502 gateway indisponível: `{ success:false, error, data:{ orderId } }` (pedido já criado: usar `update-batch-preference`).
- `POST /api/registrations/create-free-batch` (público) — body: `{ eventId, participants: [{ name, cpf, email?, phone?, dynamicFormData? }] }` (email/telefone/dinâmico conforme `fixedFieldsConfig`/`formMode`).
  - 201: `{ success:true, data:{ eventTitle, registrations:[{ id, name, status:"CONFIRMED" }] } }`. Mesmos erros (evento pago → 400).
- `POST /api/payments/update-batch-preference` (público) — body: `{ orderId }`.
  - 200: `{ success:true, data:{ gateway, orderId, checkoutUrl, totalValue, participants } }` · 404 · 409 (pedido pago, cancelado ou vazio) · 502.
- `POST /api/registrations/{registrationId}/leave-order` (público; exige o CPF da própria inscrição) — body: `{ cpf }`.
  - 200: `{ success:true, data:{ registrationId, orderId, orderCancelled, newOrderTotal, remainingParticipants, individualAmount } }`. Depois, a pessoa segue o fluxo individual de "continuar pagamento" (`create-preference` com o CPF dela).
  - 403 CPF não confere · 400 sem pedido ou inscrição não pendente · 409 pedido já pago/cancelado.
- `POST /api/registrations/search-by-cpf` (já existente) — passa a incluir `orderId` e `order: { id, status, totalValue, participantsCount, otherParticipants: [primeiros nomes], canLeave } | null`. Para o alerta do CPF em grupo (continuar o grupo via `update-batch-preference` com `order.id`, ou sair via `leave-order`).
- `GET /api/payments/status?registrationId=ord_<id>` — aceita o `order_nsu` do retorno do checkout. Devolve o `registration` no formato de sempre (representa o responsável, `status` = status do pedido) e `order: { id, status, totalValue, needsNewLink, participants:[{ id, name, status }] }`.
- `POST /api/registrations/get-by-id` — aceita `registrationId: "ord_<id>"` (resolve para o responsável); a resposta ganhou `orderId`. Comprovante de cada participante continua por `registrationId` próprio.
- Eventos públicos (`events/active`, `by-slug`, `list-active`) agora trazem `allowBatchRegistration`. O admin precisa de toggle no `EventModal` (a flag já é aceita em `POST/PUT /api/events`).

### Testes realizados (servidor local, banco local, gateway InfinitePay simulado por endpoint local; dados de teste removidos)

61 verificações, 0 falhas:

- Lote pago de 3 (com/sem camisa): total R$ 330; payload ao gateway com `order_nsu = ord_<id>`, 3 itens em centavos (12000/9000/12000), `customer` do responsável em E.164, URLs de redirect e webhook; 3 inscrições `PENDING` com o mesmo `orderId`; colunas do `Order` preenchidas; CPF só dígitos.
- Lote com preço de lote (70 + 100 = 170) e `batchId` gravado em todos.
- Erros: CPF repetido no lote (422, índices), CPF já confirmado (409), CPF em outro pedido pendente (409), campos inválidos por índice (422), mais de 10 (422), nada persistido em caso de erro.
- Vagas: global insuficiente (409), quota do lote insuficiente (409); duas requisições concorrentes pela última vaga (uma 201, outra 409, sem overbooking).
- Flag desligada → 403; lote em evento de tipo errado → 400.
- Webhook: `paid_amount` menor → 422 (segue `PENDING`); confirmação (pedido + 3 inscrições, colunas tipadas); idempotente (2ª entrega no-op); pedido inexistente → 404; link obsoleto (R$ 300 pago após saída que reduziu para R$ 210) → 200 `IGNORED`, pedido segue `PENDING`, evento no `history[]`.
- Webhook individual legado: valor menor 422, confirmação, idempotência.
- `leave-order`: CPF errado 403; saída recalcula 300 → 210 → 120; `paymentId` invalidado e `history[]`; último a sair → `CANCELLED`; já individual / pedido confirmado → 400; duas saídas concorrentes → total final consistente.
- Continuar pagamento: novo link com os 2 participantes restantes (R$ 210) e `paymentId` reposto; pedido cancelado → 409.
- `payments/status`, `get-by-id` com `ord_`, comprovante individual de participante, `search-by-cpf` com contexto de grupo.
- Gratuito em lote: 3 `CONFIRMED` (`FREE`, sem `orderId`), já inscrito (409), vagas (409), tipo de evento errado (400).
- `npx tsc --noEmit`, `npm run lint` (só warnings preexistentes) e `npm run build` limpos.

### Frontend (Fase 7) — 2026-11-11

Extensão inline do `EventRegistrationModal` (checkbox, quantidade, cartões recolhíveis, camisa por pessoa, total, erros por cartão/campo), `BatchParticipantsSection`, `BatchOrderSummary`, `GroupProofModal` (novos, em `components/registration`), Opção C no `ExistingRegistrationAlert`, retorno do checkout e `AutoShowProofModal` para `ord_`, toggle `allowBatchRegistration` no `EventModal`, tag de grupo na `RegistrationTable` (`GET /api/registrations` passou a incluir `order`). Descrição de UX em `docs/FLUXO_INSCRICAO.md`.

**Testes (servidor local, gateway simulado; dados removidos)**: lote pago de 3 com camisa (total R$ 330, payload ao gateway correto, 3 inscrições no mesmo pedido); CPF repetido no lote (erro no cartão certo); CPF já inscrito vindo do servidor (409 marcado no cartão e campo certos); voltar da etapa de pagamento preserva dados e camisa; continuar pagamento do grupo; sair do grupo (pedido recalculado para R$ 230) e pagar sozinho; retorno do checkout com lista do grupo e comprovante consolidado → individual; lote gratuito de 2; fluxo individual gratuito sem regressão; API do admin devolve o pedido. tsc/lint/build limpos.

**Desvios do RFC**: a Opção C usa os mesmos dados do `search-by-cpf` (sem tela nova); o comprovante consolidado lista as pessoas e abre o comprovante individual de cada uma (não há PDF/QR único do grupo); cartões ficam montados (ocultos) em vez de desmontados, para não perder dados.

### Pendências

- Verificação visual em viewport mobile real (375px) e dentro do navegador do Instagram/WhatsApp: a janela do navegador de automação não reduziu o viewport, então só foi testado em desktop; cobrir no E2E mobile final. Tag de grupo e toggle do admin não foram vistos no navegador (só a API e o tsc).
- Verificar em ambiente real (sandbox InfinitePay) se `amount` do webhook é mesmo o total enviado no link (base da salvaguarda 9.7); a suposição segue o comentário do webhook individual.
- Concorrência lote × individual na última vaga (individual sem lock) e job de expiração de `PENDING` antigos (RFC seção 17): fora desta entrega.
- E2E mobile, vídeo de evidência e `../testes.md` após o frontend; RFC só será marcado como implementado depois dele.
