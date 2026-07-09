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
| `maxParticipants`, `registrationStartDate`, `registrationEndDate`, `isActive` | — | Gates de disponibilidade |

Cada inscrição vira uma `Registration`:

- `status`: `PENDING → CONFIRMED / CANCELLED / PAYMENT_FAILED`
- `paymentMethod`: `INFINITE_PAY | MERCADO_PAGO | FREE | MANUAL`
- `paymentId`: referência do provedor (ou `free_<timestamp>_<rand>` em gratuito)
- `dynamicFormData` (JSON): respostas sanitizadas do formulário dinâmico
- `wantsShirt` / `shirtSize`: seleção de camisa

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
escolhidos no app — isso acontece no checkout do gateway (InfinitePay é o padrão,
via `AppSettings.activePaymentGateway`).

1. Preenche fixos (email/telefone obrigatórios) + dinâmicos se `BOTH`.
2. Etapa "Pagamento": escolhe camisa (se habilitada) e vê o valor final. "Ir para
   o pagamento" → `POST /api/payments/create-preference`.
3. Servidor valida: evento ativo/pago, **não** `DYNAMIC_ONLY`, dinâmicos (se
   `BOTH`), vagas, janela de inscrição, seleção de camisa, e recalcula `baseValue`.
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
e vice-versa. O fluxo Mercado Pago ainda existe no código como **legado** (exige
`paymentData` com método/parcelas e calcula taxas), mas não é o ativo.

## 6. Deduplicação e "continuar pagamento"

O CPF é a chave por evento. Ao digitá-lo, o hook `useCpfVerification` consulta se
já existe inscrição:

- **CONFIRMED** → bloqueia (não permite inscrever de novo).
- **PENDING / CANCELLED / PAYMENT_FAILED** → mostra `ExistingRegistrationAlert`
  com opções "Ver comprovante" ou "Continuar pagamento". Nesse caso o modal entra
  em modo `isUpdatingPayment` (etapa única "Pagamento"), pré-carrega os dados (não
  editáveis) e o backend faz **UPDATE** da inscrição existente (nova
  preferência/checkout), em vez de criar duplicata.

## 7. Resumo das combinações

| Dimensão | Opções | Onde é decidido |
|---|---|---|
| Custo | Gratuito / Pago | `isFree` + `price` |
| Formulário | `FIXED_ONLY` / `BOTH` / `DYNAMIC_ONLY` | `formMode` (+ `dynamicFormFields`) |
| Fixos opcionais | email/telefone obrigatórios ou não | `fixedFieldsConfig` (só em gratuito) |
| Campos dinâmicos | 8 tipos, até 30 campos, validações por tipo | `dynamicFormFields` |
| Camisa | Habilitada ou não; se sim, escolha opcional com tamanho obrigatório | `shirtConfig` (só pago) |
| Gateway | InfinitePay (padrão) / Mercado Pago (legado) | `AppSettings.activePaymentGateway` |

Restrições que amarram tudo: **camisa só em evento pago**; **`DYNAMIC_ONLY` só em
gratuito**; **pago só admite `FIXED_ONLY` ou `BOTH`**; valores e seleção de camisa
sempre recalculados no servidor.
</content>
</invoke>
