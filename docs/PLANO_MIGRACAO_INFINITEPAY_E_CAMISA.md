# Plano: Migração de Gateway (Mercado Pago → InfinitePay) + Item "Camisa"

> Status: **Implementado — InfinitePay-only.**
> Última atualização: 2026-06-30

## ⚠️ Decisão de arquitetura (atualização) — InfinitePay-only

Após validar as taxas reais do InfinitePay para conta CPF, ficou claro que **os dois gateways não convivem no mesmo fluxo**:

- O **Checkout InfinitePay** aceita só **Pix (grátis) e crédito** (sem débito); o cliente escolhe método/parcelas **dentro do checkout do InfinitePay**; o **repasse de taxa é configurado na conta** (global) e as taxas **variam por faixa de faturamento** do lojista — logo, calcular taxa do nosso lado é inviável e divergiria.
- O **Mercado Pago** (modelo do código original) exige escolher método e calcular a taxa **antes**, na nossa tela.

**Resolução:** o sistema opera **InfinitePay-only**. O subsistema de taxas do MP (`PaymentFeeCalculator`, `PaymentConfigForm`, `PaymentMethodSelector`) foi **removido do fluxo ativo** mas **mantido no repositório** (legado, para eventual reativação). Consequências:

- **Criação de evento**: o admin define **só o preço** (e a camisa). Não há mais configuração de taxas/passthrough/débito/parcelas por evento.
- **Inscrição**: o participante vê **só o valor** (com/sem camisa) e vai ao checkout do InfinitePay, onde escolhe Pix/crédito e vê o parcelamento. Etapas: **Dados → Pagamento**.
- **Taxas centralizadas** em `backend/utils/paymentFees.ts` (ponto único; elimina a duplicação que causava valores errados). `INFINITEPAY` é referência informativa; `MERCADO_PAGO_FEES` serve só ao legado.
- `create-preference`: `paymentData` virou opcional; validação de método/taxa vive apenas no branch MP (legado).

## 1. Contexto e objetivos

Hoje o sistema processa pagamentos **exclusivamente via Mercado Pago** (`app/api/payments/*`, `lib/mercadopago.ts`, `backend/utils/paymentFeeCalculator.ts`). Este plano cobre três mudanças:

1. **InfinitePay como gateway padrão**, com **Mercado Pago como redundância**. A escolha do gateway é uma **configuração global** do sistema (não por evento), definida pelo admin numa tela de configurações. O gateway efetivamente usado em cada inscrição fica **gravado na inscrição** e aparece nos relatórios.
2. **Repasse da taxa de cartão ao cliente** (modelo Mercado Livre), feito **ativando "Repassando taxas" na conta InfinitePay**. O checkout do InfinitePay exibe ao cliente o valor com os juros do parcelamento e o organizador recebe o valor cheio. Nós enviamos o **preço-base** e conciliamos pelo `paid_amount` do webhook.
3. **Item opcional "camisa"** no evento pago, modelado como **dois preços fixos** (sem camisa = preço base; com camisa = preço maior) + **lista de tamanhos definida pelo admin**. Ao escolher "com camisa", o participante é **obrigado** a selecionar um tamanho. Relatórios permitem **filtrar/separar quem tem camisa** e **imprimir listas separadas**.

### Decisões de produto já tomadas
- Gateway: **seleção manual e global** (não por evento). Origem do pagamento gravada na inscrição e nos relatórios.
- Camisa: **dois preços fixos** (mais simples para o participante ver o valor antes do pagamento) + **tamanho coletado dinamicamente** e obrigatório quando "com camisa".
- Repasse de taxa: **ativar na conta InfinitePay** (não embutir no preço enviado).

---

## 2. Referência técnica do InfinitePay

### Criar checkout
`POST https://api.checkout.infinitepay.io/links`

```json
{
  "handle": "<InfiniteTag da conta>",
  "redirect_url": "https://<app>/payment/success",
  "webhook_url": "https://<app>/api/payments/webhook/infinitepay",
  "order_nsu": "<id da Registration>",
  "items": [
    { "quantity": 1, "price": 5000, "description": "Inscrição - Evento X" }
  ]
}
```
- `price` em **centavos**.
- Resposta: `{ "url": "https://checkout.infinitepay.com.br/..." }` → redirecionar o cliente.

### Webhook de confirmação
Payload recebido:
```json
{
  "invoice_slug": "abc123",
  "amount": 5000,
  "paid_amount": 5250,
  "installments": 3,
  "capture_method": "credit_card",
  "transaction_nsu": "<uuid>",
  "order_nsu": "<id da Registration>",
  "receipt_url": "https://...",
  "items": [ ... ]
}
```
- Responder **`200 OK`** rapidamente (idealmente < 1s); em erro `400` o InfinitePay reenvia.
- `paid_amount ≥ amount` quando o repasse de taxa está ativo (a diferença são os juros pagos pelo cliente).
- O InfinitePay **só notifica pagamentos aprovados** — não há evento de "rejeitado" como no Mercado Pago.
- **Segurança (doc oficial):** o webhook **não tem assinatura/HMAC/secret**. A validação recomendada é conferir que o `order_nsu` corresponde a um pedido real no seu sistema **e** o valor pago. Após o pagamento, o cliente também volta ao `redirect_url` com `order_nsu`, `receipt_url` e método na URL.

### Repasse de taxa
Ativado **na conta/app InfinitePay** ("Vender → Link de Pagamento → Parcelamento e taxas → Repassando taxas"), não via API. Configuração operacional, fora do código.

### Variáveis de ambiente novas
- `INFINITEPAY_HANDLE` — InfiniteTag da conta (obrigatória em runtime).
- `INFINITEPAY_WEBHOOK_SECRET` — se o InfinitePay oferecer assinatura/HMAC (a confirmar).

---

## 3. Parte 1 — Gateway global (InfinitePay + Mercado Pago)

### 3.1 Banco de dados (`prisma/schema.prisma`)
- Novo enum `PaymentGateway { MERCADO_PAGO, INFINITE_PAY }`.
- Novo modelo singleton `AppSettings` (1 linha, id fixo `"singleton"`):
  ```prisma
  model AppSettings {
    id                   String         @id @default("singleton")
    activePaymentGateway PaymentGateway @default(INFINITE_PAY)
    updatedAt            DateTime       @updatedAt
    @@map("app_settings")
  }
  ```
- Estender enum `PaymentMethod` com `INFINITE_PAY` — `Registration.paymentMethod` passa a indicar de onde a inscrição foi paga (campo já usado em `export-admin`).
- `npm run db:push` + atualizar `prisma/seed.ts` para criar o `AppSettings` default.

### 3.2 Camada de abstração de gateway (`backend/services/payment/`)
Interface comum para isolar as rotas do gateway concreto:
- `PaymentGatewayService`:
  - `createCheckout(input) → { checkoutUrl, providerRef }`
  - `parseWebhook(payload) → { registrationRef, status, details }`
- `MercadoPagoGateway` — encapsula a lógica atual de `create-preference` + `lib/mercadopago.ts`.
- `InfinitePayGateway` — usa novo `lib/infinitepay.ts`. Monta `items`, chama o endpoint de links, usa **`order_nsu = registration.id`** para conciliação.
- `getActiveGateway()` — factory que lê `AppSettings.activePaymentGateway` via `withPrismaRetry`.

`lib/infinitepay.ts` segue o padrão de `lib/mercadopago.ts` (config + validação lazy em build via `NODE_ENV`/`VERCEL_ENV`).

### 3.3 Rotas de pagamento (`app/api/payments/`)
- **`create-preference`** — obtém o gateway ativo e delega ao serviço. Mantém o cálculo server-side do `baseValue` e o envelope `{ success, checkoutUrl, ... }` (o frontend já redireciona por `checkoutUrl`). Grava `paymentMethod`, `paymentId = providerRef`, status `PENDING`.
- **`webhook/infinitepay/route.ts`** (novo) — localiza a `Registration` por `order_nsu` (= id) e/ou `transaction_nsu`, valida que `paid_amount` cobre o valor esperado, marca `CONFIRMED`, popula `paymentDetails` (`paid_amount`, `installments`, `capture_method`, `receipt_url`, `transaction_nsu`). Responde `200`.
- **`update-preference` / `continue-payment`** — InfinitePay não tem "update"; para esse gateway, "continuar pagamento" gera **novo link** reaproveitando a `Registration` PENDING. Ramificar por gateway.
- **`status`** — para InfinitePay, a verdade vem do webhook; o polling apenas lê o status persistido (sem consultar o gateway). Ramificar por gateway.
- **`webhook` (Mercado Pago)** — permanece inalterado.

### 3.4 Middleware (`middleware.ts`)
- Adicionar `/api/payments/webhook/infinitepay` em `publicRoutes`.
- Adicionar `/admin/settings` e `/api/admin/settings` às rotas protegidas **e** ao `config.matcher`.

### 3.5 Tela de configurações globais (admin)
- `app/admin/settings/page.tsx` — Select "Gateway de pagamento ativo" (InfinitePay / Mercado Pago).
- `app/api/admin/settings/route.ts` (GET/PUT) → controller fino sobre `AppSettings`, com `requireAdmin`/`requireSuperAdmin` do `BaseController`.
- Link de acesso em `components/admin/AdminHeader.tsx`.

### 3.6 Frontend de checkout
- Generalizar `components/MercadoPagoCheckout.tsx` (ou criar análogo) para um componente que apenas redireciona ao `checkoutUrl` retornado e faz polling em `/api/payments/status`. `EventRegistrationModal.tsx` escolhe o componente conforme o gateway retornado pela API.

---

## 4. Parte 2 — Item "Camisa" (dois preços fixos + tamanho dinâmico)

### 4.1 Banco / schema
- `Event`: novo campo JSON `shirtConfig`, validado por novo `ShirtConfigSchema` em `backend/schemas/eventSchemas.ts`:
  ```ts
  { enabled: boolean, priceWithShirt: number, sizes: string[] }
  ```
  `priceWithoutShirt` = `event.price`. Refine: se `enabled`, exigir `priceWithShirt > price` e `sizes.length >= 1`.
- `Registration`: campos dedicados `wantsShirt Boolean?` e `shirtSize String?` (dedicados — não dentro de `dynamicFormData` — para facilitar filtros e listas separadas nos relatórios).

### 4.2 Admin — configuração do evento (`components/admin/EventModal.tsx`)
- Nova seção "Camisa do evento" (apenas eventos pagos): switch `enabled`, `InputNumber priceWithShirt`, editor de **tamanhos dinâmico** (add/remove) reaproveitando o padrão de opções de `components/admin/DynamicFormBuilder.tsx`.

### 4.3 Inscrição pública (`components/event/EventRegistrationModal.tsx`)
- Quando `shirtConfig.enabled`: escolha de valor entre **"Inscrição sem camisa (R$ base)"** e **"Inscrição com camisa (R$ priceWithShirt)"**.
- Ao escolher **com camisa**: radio **obrigatório** de tamanho (das `sizes`); validação bloqueia avançar sem tamanho.
- O `baseValue` enviado ao pagamento passa a ser `priceWithShirt` ou `price` conforme a escolha.

### 4.4 APIs de inscrição (recálculo server-side)
Não confiar no valor vindo do cliente:
- `app/api/payments/create-preference/route.ts`, `app/api/registrations/create-free/route.ts` e `app/api/registrations/route.ts`: aceitam `wantsShirt` + `shirtSize`; **recalculam `baseValue` no servidor** (`priceWithShirt` se `wantsShirt`, senão `price`); validam `shirtSize ∈ shirtConfig.sizes` quando `wantsShirt`; persistem `wantsShirt`/`shirtSize`.
- `app/api/admin/registrations/manual/route.ts` + `components/admin/ManualRegistrationModal.tsx`: idem para inscrição manual.
- Schemas Zod das inscrições atualizados.

### 4.5 Relatórios / impressão
- `app/api/registrations/export-admin/route.ts` (e `export/route.ts`): incluir `wantsShirt`/`shirtSize` no `select` e no payload. **Corrigir `totalRevenue`** para somar `priceWithShirt`/`price` por inscrição (hoje é `confirmed * event.price`, impreciso com camisa).
- UI de relatório/impressão (`app/admin/registrations`): filtro **"com camisa / sem camisa"** e opção de **imprimir listas separadas** (com camisa por tamanho × sem camisa).

---

## 5. Arquivos impactados

**Criar**
- `lib/infinitepay.ts`
- `backend/services/payment/` (interface + `MercadoPagoGateway` + `InfinitePayGateway` + factory)
- `app/api/payments/webhook/infinitepay/route.ts`
- `app/admin/settings/page.tsx`
- `app/api/admin/settings/route.ts`
- `AppSettings` no schema + ajustes de `prisma/seed.ts`

**Modificar**
- `prisma/schema.prisma`, `prisma/seed.ts`, `middleware.ts`
- `backend/schemas/eventSchemas.ts`
- `app/api/payments/{create-preference,update-preference,continue-payment,status}/route.ts`
- `app/api/registrations/{create-free,route,export-admin,export}/route.ts`
- `app/api/admin/registrations/manual/route.ts`
- `components/admin/{EventModal,ManualRegistrationModal,AdminHeader}.tsx`
- `components/event/EventRegistrationModal.tsx`
- `components/MercadoPagoCheckout.tsx`

**Reaproveitar**
- `lib/prisma.ts` → `withPrismaRetry` em **toda** query nova (obrigatório — ver `doc/SOLUCAO_PREPARED_STATEMENTS.md`).
- `BaseController` (respostas + `requireAdmin`).
- Padrão de edição de opções de `components/admin/DynamicFormBuilder.tsx`.
- `PaymentFeeCalculator` para o cálculo de `baseValue`.

---

## 6. Pontos a confirmar na implementação
- **Assinatura/secret do webhook InfinitePay**: confirmar na conta/documentação se há HMAC para validar a origem; caso não haja, validar por `order_nsu` existente + valor (`paid_amount ≥ amount`).
- **Sem "rejeitado" no InfinitePay**: inscrições não confirmadas permanecem `PENDING` (não há `PAYMENT_FAILED` automático como no MP).
- **Variáveis de ambiente** (`INFINITEPAY_HANDLE`, e secret se houver) devem ser provisionadas na Vercel.

---

## 7. Verificação end-to-end
1. `npm run db:push && npm run db:seed` — confirmar `AppSettings` singleton com default `INFINITE_PAY`.
2. `npm run lint && npm run build` — sem erros de tipo/Zod.
3. Admin → Configurações: alternar o gateway global e confirmar persistência.
4. Criar evento pago com camisa (preço base, preço com camisa, tamanhos P/M/G/GG).
5. Inscrição pública: "com camisa" sem tamanho → bloqueio; com tamanho → redireciona ao checkout do gateway ativo. Simular webhook (`curl` com payload InfinitePay, `order_nsu` = id da inscrição) → status `CONFIRMED`, `paymentDetails`/`paymentMethod` corretos.
6. Trocar o gateway global para Mercado Pago e repetir o fluxo (regressão do MP).
7. Relatório: filtrar com/sem camisa, conferir `shirtSize`, imprimir listas separadas e validar `totalRevenue`.
