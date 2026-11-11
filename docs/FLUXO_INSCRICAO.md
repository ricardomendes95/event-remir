# Fluxo de inscrição do participante

Documento de referência do fluxo pelo qual um usuário público se inscreve em um
evento. Cobre as combinações de formulário (campos fixos vs. dinâmicos), a opção
de camisa e a diferença entre evento gratuito e pago. Escrito para servir de
contexto rápido (inclusive para IA) — reflete o código em `components/event/EventRegistrationModal.tsx`,
`app/api/payments/create-preference/route.ts`, `app/api/registrations/create-free/route.ts`
e os schemas em `backend/schemas`.

## 1. Modelo de dados relevante

Cada `Event` (`prisma/schema.prisma`) carrega as flags que controlam o formulário
e o preço:

| Campo | Tipo | Papel |
|---|---|---|
| `isFree` | `Boolean` | Gratuito (sem pagamento) ou pago |
| `price` | `Float` | Valor base da inscrição (deve ser `0` se `isFree`) |
| `formMode` | enum `FIXED_ONLY \| DYNAMIC_ONLY \| BOTH` | Quais formulários aparecem |
| `dynamicFormFields` | `Json?` | Array de definições dos campos dinâmicos |
| `fixedFieldsConfig` | `Json?` | Se `email`/`phone` são obrigatórios (efeito só em gratuito) |
| `shirtConfig` | `Json?` | Config do item opcional "camisa" (só em evento pago) |
| `batches` | `EventBatch[]` | Lotes de inscrição (opcional, só em evento pago) — ver seção "Lotes de inscrição" |
| `allowBatchRegistration` | `Boolean` (default `false`) | Libera a inscrição de várias pessoas em uma compra — ver "Inscrição em lote" |
| `maxParticipants`, `registrationStartDate`, `registrationEndDate`, `isActive` | — | Gates de disponibilidade |

Cada inscrição vira uma `Registration`:

- `status`: `PENDING → CONFIRMED / CANCELLED / PAYMENT_FAILED`
- `paymentMethod`: `INFINITE_PAY | MERCADO_PAGO | FREE | MANUAL`
- `paymentId`: referência do provedor (ou `free_<timestamp>_<rand>` em gratuito)
- `dynamicFormData` (JSON): respostas sanitizadas do formulário dinâmico
- `wantsShirt` / `shirtSize`: seleção de camisa
- `batchId` (nullable): lote em que a inscrição foi feita (`null` em evento sem lotes e em inscrições históricas)
- `orderId` (nullable): pedido (`Order`) em grupo que originou/pagou a inscrição; `null` no fluxo individual e no histórico
- `notes` (até 500 caracteres), `manualPaymentType` (`PIX | CASH | CARD`) e
  `cashResponsible`: dados **administrativos** (ver "Inscrição manual pelo admin")

O CPF é sempre gravado **sem formatação** (apenas dígitos) e é a chave de
deduplicação por evento.

Componente central do frontend: `EventRegistrationModal.tsx`. Ele deriva todo o
comportamento das flags do evento.

## 2. As três combinações de formulário (`formMode`)

Os campos **fixos** (nome, email, CPF, telefone) aparecem **sempre**
(`showFixed = true` é constante). O `formMode` liga/desliga apenas o bloco
dinâmico:

- **`FIXED_ONLY`** — Só campos fixos.
- **`BOTH`** — Fixos **+** dinâmico, renderizados juntos na mesma etapa. Único
  modo dinâmico permitido em evento **pago**.
- **`DYNAMIC_ONLY`** — Fixos + dinâmicos também, mas **só permitido em evento
  gratuito**. O nome é enganoso: os campos fixos continuam presentes; apenas
  podem ficar opcionais. Rejeitado com defesa em profundidade na rota paga.

Regra de configuração (`EventCreateSchema`): qualquer modo diferente de
`FIXED_ONLY` exige `dynamicFormFields` com pelo menos 1 campo.

### Obrigatoriedade dos campos fixos

`RegistrationForm.tsx` sempre exige **nome** e **CPF**. Email e telefone variam:

- **Evento pago**: email e telefone **sempre obrigatórios**.
- **Evento gratuito**: email e telefone obrigatórios **apenas se**
  `fixedFieldsConfig.email.required` / `.phone.required` estiver marcado; caso
  contrário, opcionais (rótulo mostra "(opcional)").

## 3. Campos dinâmicos

Definidos em `backend/schemas/dynamicFormSchemas.ts`. Base comum de cada campo:
`id` (slug `[a-z0-9_]`), `label`, `required` (boolean), `helpText?`. Os **8 tipos**
(discriminated union por `type`):

| Tipo | Controle | Validações específicas |
|---|---|---|
| `text` | Input | `minLength`, `maxLength`, `placeholder` |
| `textarea` | TextArea | `minLength`, `maxLength`, `placeholder` |
| `number` | InputNumber | `min`, `max`, `integer` |
| `phone` | Input máscara `(00) 00000-0000` | 10–11 dígitos; salva só dígitos |
| `cpf` | Input máscara CPF | validação matemática; salva só dígitos |
| `select` | Dropdown | `options[]` (value/label únicos, 1–50) |
| `radio` | Radio group | `options[]` |
| `checkbox` | Checkbox único **ou** grupo | `multi: boolean` — `true` = múltipla escolha (salva `string[]`); `false` = booleano |

Limites: máximo **30 campos** por evento, IDs únicos. Layout: `textarea`, `radio`
e `checkbox multi` ocupam largura total; os demais ficam em grid de 2 colunas.

**Validação dupla**: o cliente valida via Ant Design (`buildRules` em
`DynamicFormRenderer.tsx`); o servidor **revalida e sanitiza** com
`validateDynamicFormData` (`backend/utils/dynamicFormValidator.ts`), checando
tipo, obrigatoriedade, ranges e pertencimento das opções ao conjunto válido. Só o
objeto **sanitizado** é persistido em `dynamicFormData` — nunca o payload cru.

## 4. Opção de camisa

Configurada em `shirtConfig` (`ShirtConfigSchema`): `{ enabled, priceWithShirt, sizes[] }`.

Regras de configuração (validadas em `EventCreateSchema`):

- Só permitida em **evento pago** (`!isFree`).
- `priceWithShirt` deve ser **maior** que o `price` base.
- Precisa de ao menos 1 tamanho; tamanhos livres e únicos (ex.: `["P","M","G","GG"]`).

No modal (`shirtConfig` só ativa se `!isFreeEvent && event.shirtConfig?.enabled`):
na etapa de pagamento aparecem dois cartões — "Inscrição sem camisa"
(`event.price`) e "Inscrição com camisa" (`shirtConfig.priceWithShirt`). Ao
escolher "com camisa", surge a seleção de **tamanho, que passa a ser
obrigatória** (bloqueia o submit se vazio).

No servidor (`create-preference`): nunca confia no cliente.
`validateShirtSelection` (`backend/utils/shirtPricing.ts`) normaliza a escolha (se
o evento não oferece camisa, `wantsShirt` vira `false`; se optou, valida o tamanho
contra a lista) e `resolveBaseValue` recalcula o valor. O valor cobrado é sempre o
recalculado no backend.

## 5. Fluxo passo a passo por cenário

### A) Evento GRATUITO (`isFree = true`)

Etapas do modal: **Dados → Confirmar inscrição** (2 passos, sem pagamento).

1. Preenche fixos (+ dinâmicos se `BOTH`/`DYNAMIC_ONLY`). Submit valida com
   `freeRegistrationSchema` (email/phone opcionais).
2. Tela de confirmação com resumo dos dados e respostas.
3. "Finalizar Inscrição" → `POST /api/registrations/create-free`.
4. Servidor revalida: evento ativo, gratuito, dentro da janela, com vaga;
   obrigatoriedade de email/phone conforme `fixedFieldsConfig`; CPF válido; dedup
   por CPF (bloqueia se já houver `CONFIRMED`); valida dinâmicos.
5. Cria `Registration` com `status = CONFIRMED`, `paymentMethod = FREE`,
   `paymentId = "free_<timestamp>_<rand>"`.
6. Frontend busca o comprovante (`get-by-id`) e abre o `RegistrationProofModal`.
   **Sem redirecionamento externo.**

### B) Evento PAGO (`isFree = false`)

Etapas do modal: **Dados → Pagamento** (2 passos). Método e parcelas **não** são
escolhidos no app — isso acontece no checkout do InfinitePay (gateway único
desde a remoção do Mercado Pago em 2026-07-22).

1. Preenche fixos (email/telefone obrigatórios) + dinâmicos se `BOTH`.
2. Etapa "Pagamento": escolhe camisa (se habilitada) e vê o valor final. "Ir para
   o pagamento" → `POST /api/payments/create-preference`.
3. Servidor valida: evento ativo/pago, **não** `DYNAMIC_ONLY`, dinâmicos (se
   `BOTH`), janela de inscrição, seleção de camisa e, numa transação, vagas
   (só `PENDING` + `CONFIRMED` ocupam vaga) e lote vigente; recalcula `baseValue`
   com o preço do lote vigente (ver "Lotes de inscrição").
4. **Persiste a `Registration` primeiro** (`status = PENDING`,
   `paymentMethod = INFINITE_PAY`) para obter o `id`, que vira o `order_nsu` do
   gateway.
5. Chama `createInfinitePayCheckoutForRegistration`, grava o `paymentId`
   (referência do provedor) e retorna `checkoutUrl`.
6. Frontend redireciona (`redirectToPayment`) para o checkout. Há **fallback
   manual** (botão/link) para iOS/Instagram quando o redirect automático falha.
7. Confirmação do pagamento chega **depois, via webhook** do gateway, que muda o
   `status` para `CONFIRMED` (ou `PAYMENT_FAILED`).

Guardas cruzadas: `create-preference` rejeita evento gratuito ("use create-free")
e vice-versa. O código do Mercado Pago foi **removido em 2026-07-22** — o valor
`MERCADO_PAGO` permanece no enum `paymentMethod` apenas para inscrições
históricas.

## 6. Deduplicação e "continuar pagamento"

O CPF é a chave por evento. Ao digitá-lo, o hook `useCpfVerification` consulta se
já existe inscrição:

- **CONFIRMED** → bloqueia (não permite inscrever de novo).
- **PENDING / CANCELLED / PAYMENT_FAILED** → mostra `ExistingRegistrationAlert`
  com opções "Ver comprovante" ou "Continuar pagamento". Nesse caso o modal entra
  em modo `isUpdatingPayment` (etapa única "Pagamento"), pré-carrega os dados (não
  editáveis) e o backend faz **UPDATE** da inscrição existente (nova
  preferência/checkout), em vez de criar duplicata. Se o lote vigente mudou
  desde a primeira tentativa, cobra-se o **preço do lote atual** e o `batchId`
  da inscrição é atualizado; a própria inscrição não conta como vaga ocupada.

## 7. Resumo das combinações

| Dimensão | Opções | Onde é decidido |
|---|---|---|
| Custo | Gratuito / Pago | `isFree` + `price` |
| Formulário | `FIXED_ONLY` / `BOTH` / `DYNAMIC_ONLY` | `formMode` (+ `dynamicFormFields`) |
| Fixos opcionais | email/telefone obrigatórios ou não | `fixedFieldsConfig` (só em gratuito) |
| Campos dinâmicos | 8 tipos, até 30 campos, validações por tipo | `dynamicFormFields` |
| Camisa | Habilitada ou não; se sim, escolha opcional com tamanho obrigatório | `shirtConfig` (só pago) |
| Lotes | Sem lotes (preço único) ou com lotes (preço/período/vagas por lote) | `EventBatch` (só pago) |
| Gateway | InfinitePay (único) | fixo no código (`create-preference`) |

Restrições que amarram tudo: **camisa só em evento pago**; **`DYNAMIC_ONLY` só em
gratuito**; **pago só admite `FIXED_ONLY` ou `BOTH`**; valores e seleção de camisa
sempre recalculados no servidor.
</content>
</invoke>

## Lotes de inscrição

Opcionais, só em evento **pago**. Cada `EventBatch` tem nome, período
(`startDate`–`endDate`), vagas (`quota`, opcional), ordem de uso (`priority`),
`price`, `priceWithShirt` (obrigatório e maior que `price` quando o evento tem
camisa) e `isActive`. São gerenciados na seção "Lotes de inscrição" do
`EventModal` e salvos junto com o evento (`batches` no `POST/PUT /api/events`,
sincronizados em transação; lote que já tem inscrições não pode ser removido,
só desativado).

- **Evento sem lotes**: nada muda; vale `price`/`shirtConfig` do evento.
- **Lote vigente** (`resolveActiveBatch`, `backend/utils/eventBatches.ts`): ativo,
  dentro do período e com vaga no lote; havendo mais de um, vence a menor
  `priority`. A janela de inscrição do evento e o teto `maxParticipants`
  continuam valendo por cima dos lotes.
- **Evento com lotes e nenhum vigente** → inscrições fechadas
  ("Período de inscrições encerrado", 400 no `create-preference`).
- **Vagas**: global e por lote contam só `PENDING` + `CONFIRMED`
  (`OCCUPYING_STATUSES`); `CANCELLED`/`PAYMENT_FAILED` liberam a vaga.
- **Preço**: `resolveBaseValue(event, wantsShirt, batch)` usa o preço do lote;
  `create-preference` grava o `batchId`. O webhook confere o valor pelo lote
  **gravado na inscrição**, não pelo vigente no momento. Relatórios e financeiro
  usam o lote da inscrição.
- **APIs públicas** (`events/active`, `by-slug`, `list-active`): `price` e
  `shirtConfig.priceWithShirt` já saem com os valores do lote vigente, mais
  `activeBatch` (nome, preços, fim do período, `limitedByQuota`) e
  `batchesClosed`. Quotas e contagens dos lotes nunca são expostas.
- **UI pública**: o card do evento mostra o lote vigente e até quando vale
  ("1º Lote · até 15/08 ou enquanto houver vagas"); a etapa de pagamento mostra
  o nome do lote. Nenhum passo novo.
- **Inscrição manual do admin** recebe o lote vigente (ou fica sem lote); não é
  bloqueada pelo fim dos lotes.
- Limitação conhecida: no fluxo **individual** (`create-preference`), a checagem
  de vagas e a gravação rodam numa transação, mas sem lock; duas inscrições
  simultâneas na última vaga ainda podem passar. Os endpoints de **lote** já
  travam o evento (`SELECT ... FOR UPDATE`) — ver "Inscrição em lote".

## Inscrição em lote (várias inscrições, um pagamento)

Só com `Event.allowBatchRegistration = true` (default `false`; o admin liga por
evento). O fluxo individual **não muda**: continua com `order_nsu =
registration.id` e `Registration.orderId = null`. Especificação completa em
`docs/RFC_INSCRICAO_EM_LOTE.md`; execução em
`docs/melhorias-2.0/melhorias/02-inscricao-em-lote.md` (inclui o contrato das
rotas para o frontend).

- **Modelo**: `Order` (tipo `BATCH`) 1:N `Registration` (`orderId`). O `Order`
  guarda status, `totalValue`, o link vigente (`paymentId`, `checkoutUrl`) e, após
  o pagamento, colunas tipadas do gateway (`transactionNsu`, `invoiceSlug`,
  `receiptUrl`, `amountCents`, `paidAmountCents`, `paidAt`). `paymentDetails`
  guarda o payload do gateway e o `history[]` (saídas, pagamentos obsoletos).
  Tipos `REGISTRATION`/`SHIRT_ONLY` e `targetRegistrationId` já existem no schema
  (ADR-001), mas só `BATCH` é usado.
- **Limite**: `MAX_BATCH_SIZE = 10` participantes por compra (validado no servidor).
  O 1º participante é o "Responsável pela compra" (dados usados no `customer` do
  checkout).
- **Criação pago** (`POST /api/payments/create-batch-preference`): valida evento
  (ativo, pago, janela, flag) e cada participante (CPF, camisa, dinâmico), com
  erros agregados por índice; numa única `$transaction` **trava a linha do
  evento**, confere conflitos de CPF, vagas globais (`maxParticipants`) e a quota
  do lote vigente (N vagas de uma vez), cria o `Order` e as N inscrições
  `PENDING`. Todos os participantes usam o **mesmo lote vigente** na criação;
  total = soma de `resolveBaseValue(event, wantsShirt, lote)`. Só depois chama o
  gateway: um item por participante, `order_nsu = "ord_" + order.id`.
- **Criação gratuito** (`POST /api/registrations/create-free-batch`): mesma
  validação e mesmo lock; cria N inscrições `CONFIRMED` (`FREE`), sem `Order`.
- **Conflitos de CPF**: repetido no próprio lote (422); já `CONFIRMED` no evento
  (409); `PENDING` em outro pedido ou `PENDING` individual (409); `CANCELLED` /
  `PAYMENT_FAILED` é reaproveitada (UPDATE), como no fluxo individual.
- **Padrão de lock** (primeiro uso no projeto, `lockRow` em
  `backend/services/batchRegistrationService.ts`): dentro de `$transaction`,
  `SELECT id FROM events|orders WHERE id = ... FOR UPDATE`. Transações
  concorrentes na mesma linha esperam; vagas e total nunca são lidos
  desatualizados. Usado em criação (evento) e em leave-order, continuar e
  webhook (pedido). `withPrismaRetry` envolve a transação inteira.
- **Webhook** (`order_nsu` com prefixo `ord_`, tratado em
  `confirmOrderFromWebhook`; o ramo legado fica intacto): sob lock do pedido é
  idempotente (`CONFIRMED` → no-op), recusa `paid_amount` menor que o total
  recalculado (422), grava as colunas tipadas e confirma pedido + inscrições
  na mesma transação. **Link obsoleto (RFC 9.7)**: se o `amount` do webhook (valor
  do link que geramos) difere do total atual, o pedido não é confirmado; registra
  `stale_payment_received` em `paymentDetails.history[]` e responde 200 para
  conciliação manual.
- **Continuar pagamento** (`POST /api/payments/update-batch-preference`): pedido
  `PENDING` gera novo link com os participantes atuais e regrava o `paymentId`.
- **Sair do pedido** (`POST /api/registrations/{id}/leave-order`, exige o CPF da
  própria inscrição): sob lock do pedido, a inscrição vira individual
  (`orderId = null`, segue `PENDING`), o total é recalculado com o lote das
  remanescentes, o link é invalidado (`paymentId = null`) e a saída vai para o
  `history[]`. Último participante fora → pedido `CANCELLED`. Só com pedido e
  inscrição `PENDING`.
- **Consulta**: `payments/status` e `registrations/get-by-id` aceitam o
  `order_nsu` `ord_...` (o retorno do checkout o envia) e resolvem para o
  responsável; cada participante mantém seu próprio comprovante por
  `registrationId`. `search-by-cpf` devolve `orderId` e `order` (total, quantidade,
  primeiros nomes dos demais, `canLeave`) — nunca CPF/e-mail/telefone de terceiros.

### Frontend do lote (`EventRegistrationModal`)

Extensão inline do modal existente (sem wizard); o fluxo individual é o padrão e
continua igual quando o checkbox fica desmarcado ou o evento não tem a flag.

- **Dados**: logo após o formulário do responsável (Pessoa 1), o checkbox
  "Inscrever mais pessoas nesta mesma compra" (só se `allowBatchRegistration`).
  Marcado, aparece o seletor de quantidade (2 a `MAX_BATCH_SIZE`, "contando com
  você") e um cartão recolhível por pessoa (`BatchParticipantsSection`) com nome
  visível e status (Preenchido / Faltam dados / Corrigir). Os cartões ficam
  montados (só ocultos) e os valores são recolhidos ao avançar, então nada se perde
  ao voltar; reduzir a quantidade ou desmarcar com dados preenchidos pede
  confirmação; com o grupo ativo o modal não fecha ao tocar fora. Botão "Usar
  e-mail e telefone do responsável" em cada cartão.
- **Validação**: cada cartão valida o próprio formulário (mesmas regras do
  individual) + CPF repetido entre as pessoas; erros abrem o cartão e há um
  resumo clicável. Erros do servidor (`errors[{index, field, message}]`, 422/409)
  voltam à etapa de dados, abrem o cartão do `index` e marcam o campo exato
  (inclusive `dynamicFormData.<id>`); erros de camisa ficam na etapa de pagamento.
- **Pagamento (pago)**: `BatchOrderSummary` lista cada pessoa com o preço, a
  escolha de camisa (sem/com + tamanho) e o total do pedido; botão
  "Ir para o pagamento · R$ total". Chama `create-batch-preference` e redireciona
  a `data.checkoutUrl` (mesmo fallback manual do individual). Se o gateway falha
  (502 com `data.orderId`), o próximo toque chama `update-batch-preference` em
  vez de criar outro pedido.
- **Gratuito**: confirmação com a lista de pessoas; `create-free-batch`; abre o
  comprovante consolidado.
- **CPF em pedido pendente (Opção C)**: o `ExistingRegistrationAlert` mostra o
  grupo (quantidade, primeiros nomes, total) e dois botões: "Continuar pagamento
  do grupo" (`update-batch-preference`) e "Sair do grupo e me inscrever sozinho"
  (confirmação → `leave-order` → segue o fluxo individual de continuar pagamento).
- **Comprovante**: após o pagamento, `payments/success?order_nsu=ord_...` mostra
  as pessoas e o total e leva a `?registration_id=ord_...&comprovante=true`, que
  abre o `GroupProofModal` (consolidado); cada pessoa abre o
  `RegistrationProofModal` individual (QR de check-in). A busca por CPF segue
  devolvendo o comprovante individual.
- **Admin**: toggle "Inscrição em grupo" no `EventModal`; a tabela de inscrições
  mostra a tag "Grupo" (responsável ou "Resp.: nome") — `GET /api/registrations`
  inclui `order`.

## Inscrição manual pelo admin

Criada/editada no `RegistrationModal` (`POST /api/registrations` e
`PUT /api/registrations/[id]`, validados por `AdminRegistrationCreateSchema` /
`AdminRegistrationUpdateSchema`; erros voltam em 422 com `errors[]`).

- Origem do pagamento: `InfinitePay` ou `Manual`. Com **Manual**, "Como foi
  pago?" (PIX, Dinheiro ou Cartão) é obrigatório; com outra origem, é proibido.
- Com **Dinheiro**, o campo opcional "Responsável pelo dinheiro"
  (`cashResponsible`) indica quem está com o valor; só vale para `CASH`.
- **Observação** (`notes`, até 500 caracteres) vale para qualquer origem e é
  só para a equipe.
- Na edição, trocar a origem para algo que não é Manual limpa o sub-método e o
  responsável. Mudar só o status não valida o pagamento (manuais antigas
  continuam editáveis).
- Inscrições manuais antigas têm `manualPaymentType = null` e aparecem como
  "Manual (não informado)" na tabela e no financeiro.
- Visibilidade: ADMIN, SUPER_ADMIN e SUPPORT veem e editam observação e
  responsável; CHECKIN não recebe `notes`/`cashResponsible`
  (`canViewRegistrationNotes` + `registrationSerializer`). Rotas públicas
  (comprovante, busca por CPF) nunca os devolvem.
- Financeiro (`/admin/financial`): Manual quebrado por PIX/Dinheiro/Cartão/Não
  informado, total em espécie destacado, responsáveis pelo dinheiro listados e
  CSV com "Pagamento Manual", "Responsável pelo Dinheiro" e "Observação".
