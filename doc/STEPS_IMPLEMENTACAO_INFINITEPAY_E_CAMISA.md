# Steps de Implementação — InfinitePay + Item "Camisa"

> Guia executável, dividido por fases e **pré-requisitos**. Cada fase só começa quando a anterior de que depende está concluída.
> Documento companheiro: `doc/PLANO_MIGRACAO_INFINITEPAY_E_CAMISA.md` (estratégia geral).
> Princípios transversais: **mobile-first**, **UX para usuários leigos**, **bloqueio de navegador embutido** em todo fluxo de pagamento.

> **STATUS: Fases 0–9 implementadas** (branch `feat/infinitepay-e-camisa`). Verificação automatizada OK (`tsc` 0 erros, `lint` só warnings, `build` compilado). Pendente: testes E2E manuais em staging (webhook InfinitePay real, fluxo no celular, navegador embutido) — ver §9. Ação do usuário: preencher `INFINITEPAY_HANDLE` no ambiente real.
>
> **Webhook InfinitePay — segurança (confirmado na doc oficial):** o Checkout InfinitePay **não envia assinatura/HMAC/secret**. A validação implementada segue a recomendação oficial: conferir que o `order_nsu` corresponde a um pedido real (`registration.id`) **e** que o `paid_amount`/`amount` cobre o valor esperado da inscrição. Não há `INFINITEPAY_WEBHOOK_SECRET`.

---

## Mapa de dependências (ordem de execução)

```
FASE 0  Fundação (env + schema + seed)
   │  (bloqueia todas as demais)
   ├──► FASE 1  Backend: abstração de gateway
   │        │
   │        ├──► FASE 3  Backend: rotas de pagamento + webhook InfinitePay
   │        └──► FASE 4  Admin: configuração global do gateway (back + front)
   │
   └──► FASE 2  Backend: schema/validação da camisa
            │
            ├──► FASE 5  Admin: configuração da camisa no evento (front)
            └──► FASE 6  Inscrição pública: camisa + checkout (front)
                     │
                     ├──► FASE 7  Bloqueio de navegador embutido (garantia)
                     └──► FASE 8  Relatórios (com/sem camisa + origem do pagamento)

FASE 9  QA / verificação end-to-end (após todas)
```

**Caminho crítico recomendado:** 0 → 1 → 3 → 4 (gateway funcionando) e, em paralelo, 0 → 2 → 5 → 6 (camisa). Fechar com 7, 8 e 9.

---

## FASE 0 — Fundação (pré-requisito de tudo) ✅ CONCLUÍDA

**Objetivo:** preparar banco, enums e variáveis de ambiente. Nada de UI ainda.

### Backend
1. **Variáveis de ambiente** (`.env`, `.env.example` e Vercel):
   - `INFINITEPAY_HANDLE` — InfiniteTag da conta (obrigatória em runtime).
   - `INFINITEPAY_WEBHOOK_SECRET` — opcional; preencher se o InfinitePay oferecer assinatura.
   - Manter as do Mercado Pago intactas.
2. **`prisma/schema.prisma`:**
   - Novo enum:
     ```prisma
     enum PaymentGateway { MERCADO_PAGO INFINITE_PAY }
     ```
   - Estender `enum PaymentMethod` com `INFINITE_PAY` (mantém `MERCADO_PAGO`, `MANUAL`, `FREE`).
   - Novo modelo singleton:
     ```prisma
     model AppSettings {
       id                   String         @id @default("singleton")
       activePaymentGateway PaymentGateway @default(INFINITE_PAY)
       updatedAt            DateTime       @updatedAt
       @@map("app_settings")
     }
     ```
   - `Event`: `shirtConfig Json?` (detalhado na Fase 2).
   - `Registration`: `wantsShirt Boolean? @default(false)` e `shirtSize String?`.
3. **`prisma/seed.ts`:** `upsert` do `AppSettings` com id `"singleton"` e `activePaymentGateway: INFINITE_PAY`.
4. Rodar `npm run db:push` e `npm run db:seed`.

### Critério de pronto
- `npx prisma studio` mostra a tabela `app_settings` com 1 linha (`INFINITE_PAY`).
- `Registration` tem as colunas `wantsShirt`/`shirtSize`; `Event` tem `shirtConfig`.

---

## FASE 1 — Backend: abstração de gateway

**Pré-requisito:** Fase 0.
**Objetivo:** isolar o resto do código de qual gateway está em uso.

### Backend
1. **`lib/infinitepay.ts`** (espelha `lib/mercadopago.ts`):
   - Config a partir de `INFINITEPAY_HANDLE` / `INFINITEPAY_WEBHOOK_SECRET`, com validação **lazy** (não validar em build: checar `NODE_ENV`/`VERCEL_ENV` como em `lib/mercadopago.ts`).
   - `createInfinitePayCheckout({ orderNsu, items, redirectUrl, webhookUrl }) → { url }` via `POST https://api.checkout.infinitepay.io/links`. `items[].price` em **centavos**.
   - `validateInfinitePayConfig()`.
2. **`backend/services/payment/PaymentGatewayService.ts`** — interface:
   ```ts
   interface CreateCheckoutInput {
     registration: { id: string; name: string; email?: string | null; cpf: string; phone?: string | null };
     event: { id: string; title: string };
     baseValue: number;           // já calculado server-side (inclui camisa)
     method: "pix" | "credit_card" | "debit_card";
     installments?: number;
   }
   interface CreateCheckoutResult { gateway: "MERCADO_PAGO" | "INFINITE_PAY"; checkoutUrl: string; providerRef: string; }
   interface ParsedWebhook { registrationRef: string; status: "CONFIRMED" | "PENDING" | "PAYMENT_FAILED" | "CANCELLED"; details: Record<string, unknown>; }
   interface PaymentGatewayService {
     createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
     parseWebhook(payload: unknown): ParsedWebhook;
   }
   ```
3. **`backend/services/payment/MercadoPagoGateway.ts`** — extrai a lógica hoje em `app/api/payments/create-preference/route.ts` (montagem de `Preference`, `metadata`, `back_urls`, `notification_url`) por trás de `createCheckout`. `parseWebhook` reaproveita o mapeamento de status já existente no webhook do MP.
4. **`backend/services/payment/InfinitePayGateway.ts`** — `createCheckout` monta `items` (1 item: "Inscrição — <evento>"), usa **`order_nsu = registration.id`**, `webhook_url = <APP_URL>/api/payments/webhook/infinitepay`, `redirect_url = <APP_URL>/payment/success`. `parseWebhook` lê `order_nsu`, `paid_amount`, `transaction_nsu`, `installments`, `capture_method`, `receipt_url`; status sempre `CONFIRMED` (InfinitePay só notifica aprovação).
5. **`backend/services/payment/index.ts`** — `getActiveGateway(): Promise<PaymentGatewayService>` lê `AppSettings.activePaymentGateway` com **`withPrismaRetry`** (`lib/prisma.ts`) e devolve a instância correta.

### Critério de pronto
- `getActiveGateway()` retorna `InfinitePayGateway` por padrão; trocar a linha no banco devolve `MercadoPagoGateway`.

---

## FASE 2 — Backend: schema/validação da camisa

**Pré-requisito:** Fase 0.
**Objetivo:** validar configuração da camisa no evento e os dados de inscrição.

### Backend (`backend/schemas/eventSchemas.ts`)
1. `ShirtConfigSchema`:
   ```ts
   const ShirtConfigSchema = z.object({
     enabled: z.boolean(),
     priceWithShirt: z.number().min(0),
     sizes: z.array(z.string().min(1).max(20)).max(20),
   }).optional();
   ```
2. Em `EventCreateSchema` adicionar `shirtConfig: ShirtConfigSchema` + refines:
   - Se `shirtConfig.enabled`: exigir `priceWithShirt > price` e `sizes.length >= 1`.
   - Camisa só é permitida em **evento pago** (`!isFree`).
3. **Schemas de inscrição** (`create-free`, paga e manual): aceitar `wantsShirt: boolean` e `shirtSize: string | undefined`. Refine: se `wantsShirt`, `shirtSize` é obrigatório (a validação forte de pertencer a `sizes` é feita na rota, que conhece o evento).
4. **Helper de preço** (reutilizável por todas as rotas): `resolveBaseValue(event, wantsShirt)` → `wantsShirt && shirtConfig?.enabled ? shirtConfig.priceWithShirt : event.price`. Colocar junto a `PaymentFeeCalculator` ou em `backend/utils/`.

### Critério de pronto
- Teste unitário/manual do schema: evento com camisa sem tamanhos → erro; `priceWithShirt <= price` → erro.

---

## FASE 3 — Backend: rotas de pagamento + webhook InfinitePay

**Pré-requisito:** Fases 1 e 2.

### Backend
1. **`app/api/payments/create-preference/route.ts`:**
   - Aceitar `wantsShirt` + `shirtSize` no body.
   - **Recalcular `baseValue` no servidor** via `resolveBaseValue(event, wantsShirt)` (nunca confiar no cliente).
   - Validar `shirtSize ∈ event.shirtConfig.sizes` quando `wantsShirt`.
   - Obter `getActiveGateway()` e chamar `createCheckout(...)`.
   - Persistir na `Registration`: `status: PENDING`, `paymentMethod` = gateway ativo, `paymentId = providerRef`, `wantsShirt`, `shirtSize`, `dynamicFormData`.
   - Resposta mantém envelope com `checkoutUrl` (+ `gateway`).
2. **`app/api/payments/webhook/infinitepay/route.ts`** (novo):
   - `parseWebhook` → localizar `Registration` por `order_nsu` (= id) e/ou `transaction_nsu`.
   - Validar `paid_amount ≥ valor esperado`. Se `INFINITEPAY_WEBHOOK_SECRET` existir, validar assinatura; senão, validar existência do pedido + valor.
   - `update` (com `withPrismaRetry`): `status: CONFIRMED`, `paymentId`, `paymentDetails` = `{ paid_amount, installments, capture_method, receipt_url, transaction_nsu }`.
   - Responder **`200`** sempre que processado; `4xx` apenas para forçar reenvio.
3. **`update-preference` / `continue-payment`:** ramificar por gateway. Para InfinitePay, "continuar pagamento" **gera novo link** reutilizando a `Registration` PENDING (não há update de preferência).
4. **`status`:** para InfinitePay, ler o status persistido no banco (a verdade vem do webhook), sem consultar o gateway.
5. **`middleware.ts`:** adicionar `/api/payments/webhook/infinitepay` em `publicRoutes`.

### Critério de pronto
- `curl` POST no webhook com `order_nsu` de uma inscrição PENDING → vira `CONFIRMED` com `paymentDetails` preenchido.

---

## FASE 4 — Admin: configuração global do gateway (back + front)

**Pré-requisito:** Fase 1.

### Backend
1. **`app/api/admin/settings/route.ts`** (GET/PUT) → controller fino sobre `AppSettings`, usando `requireAdmin`/`requireSuperAdmin` e respostas do `BaseController`. Todas as queries com `withPrismaRetry`.
2. **`middleware.ts`:** incluir `/admin/settings` e `/api/admin/settings` nas rotas protegidas **e** no `config.matcher`.

### Frontend — UX/UI (`app/admin/settings/page.tsx`)
- **Mobile-first:** card único centralizado, largura máx. confortável, campos empilhados.
- Componente: `Segmented` ou `Radio.Group` grande (Ant Design) com **dois cartões visuais** "InfinitePay (padrão)" e "Mercado Pago (redundância)", cada um com ícone/logo e uma linha explicativa em linguagem simples ("Gateway usado em todas as novas inscrições pagas").
- Badge "Ativo" no selecionado. Botão **Salvar** fixo, com `message.success` ao salvar.
- Texto de ajuda: "Esta opção vale para o site todo. Inscrições já criadas não mudam de gateway."
- Link de acesso em `components/admin/AdminHeader.tsx` (item "Configurações").

### Critério de pronto
- Trocar gateway no admin (no celular) e ver persistência após reload.

---

## FASE 5 — Admin: configuração da camisa no evento (front)

**Pré-requisito:** Fase 2.

### Frontend — UX/UI (`components/admin/EventModal.tsx`)
- Nova seção **"Camisa do evento"**, visível **apenas para evento pago** (some quando `isFree`).
- Controles (empilhados, mobile-first):
  1. `Switch` "Oferecer camisa neste evento".
  2. Ao ativar, revelar: `InputNumber` **"Valor da inscrição com camisa (R$)"** (com `prefix R$`, `step 1`, `min` > preço base) e validação inline "deve ser maior que o valor sem camisa (R$ X)".
  3. Editor de **tamanhos** dinâmico (lista add/remover), reaproveitando o padrão de opções de `components/admin/DynamicFormBuilder.tsx`. Placeholder com exemplo "P, M, G, GG".
- Microcopy de ajuda: "O participante poderá escolher entre se inscrever com ou sem camisa. Se escolher com camisa, será obrigado a informar o tamanho."
- Bloquear edição de tamanhos quando o evento já tem inscrições (mesmo guard usado em `DynamicFormBuilder`), evitando inconsistência de relatórios.

### Critério de pronto
- Criar/editar evento pago com camisa, 4 tamanhos, e `priceWithShirt`. Salvar e reabrir mantém os dados.

---

## FASE 6 — Inscrição pública: camisa + checkout (front)

**Pré-requisito:** Fases 3 e 5.
**Objetivo:** experiência de inscrição clara no celular, com escolha de camisa e redirecionamento de pagamento robusto.

### Frontend — UX/UI (`components/event/EventRegistrationModal.tsx` + seletor de valor)
1. **Etapa de escolha de inscrição** (quando `shirtConfig.enabled`), antes do pagamento:
   - Dois **cartões selecionáveis grandes** (tap-friendly, mín. 48px de altura), mobile-first:
     - "Inscrição **sem camisa** — R$ {base}"
     - "Inscrição **com camisa** — R$ {priceWithShirt}"
   - Cada cartão com radio visual e valor em destaque. Estado selecionado com borda/realce claro.
2. **Tamanho da camisa (condicional e obrigatório):**
   - Ao selecionar "com camisa", revelar `Radio.Group` de tamanhos como **botões grandes** (`Radio.Button` ou chips), não um `select` pequeno — melhor toque no celular.
   - Validação: não permite avançar sem tamanho; mensagem clara "Escolha o tamanho da camisa".
   - Se trocar para "sem camisa", limpar `shirtSize`.
3. **Resumo do valor** sempre visível antes do botão de pagamento ("Você vai pagar: **R$ X**"), para o leigo confirmar antes de ir ao checkout.
4. **Envio:** mandar `wantsShirt` + `shirtSize` para a API; o valor é recalculado no servidor (Fase 3).
5. **Redirecionamento de pagamento:** usar a função existente `redirectToPayment(checkoutUrl)` de `utils/paymentRedirect.ts` — **independe do gateway** (InfinitePay ou MP retornam `checkoutUrl`). Manter o tratamento de iOS/WebView/Instagram já presente.
6. **Componente de checkout:** generalizar `components/MercadoPagoCheckout.tsx` (ou criar `PaymentCheckout`) para apenas exibir estados (processando/redirecionando/erro) e chamar `redirectToPayment(checkoutUrl)` + polling em `/api/payments/status`. Selecionar componente conforme `gateway` retornado pela API.

### Acessibilidade / leigos
- Linguagem simples, sem jargão ("Pagamento", "Tamanho da camisa", "Você vai pagar").
- Botões com rótulo de ação claro ("Ir para o pagamento").
- Feedback de carregamento explícito ao redirecionar.

### Critério de pronto
- No celular: escolher "com camisa" sem tamanho → bloqueio; com tamanho → resumo correto → redireciona ao checkout do gateway ativo.

---

## FASE 7 — Bloqueio de navegador embutido (garantia)

**Pré-requisito:** Fase 6.
**Objetivo:** replicar para o InfinitePay a mesma proteção já usada (problema histórico com o Mercado Pago em navegador in-app).

### O que já existe (reaproveitar, não recriar)
- `components/EmbeddedBrowserWarningModal.tsx` — detecta Instagram/Facebook/Line/LinkedIn/Twitter/TikTok pela UA e instrui abrir no navegador externo (com GIF iOS/Android e botão "copiar link").
- `utils/paymentRedirect.ts` → `redirectToPayment` / `detectEmbeddedEnvironment` — redirecionamento robusto (window.open vs location) por ambiente.
- Hoje o bloqueio é aplicado **apenas em eventos pagos** (commit `46dd3b1`).

### Steps
1. Garantir que o fluxo InfinitePay passe **sempre** por `redirectToPayment(checkoutUrl)` (Fase 6) — assim herda o tratamento de embebido automaticamente.
2. Confirmar que `EmbeddedBrowserWarningModal` é montado na página/modal de inscrição de **evento pago** independentemente do gateway (a lógica é por evento pago, não por gateway — validar que não há acoplamento ao Mercado Pago).
3. Se algum ponto novo do InfinitePay abrir URL diretamente (`window.location`/`<a>`), **substituir por `redirectToPayment`**.
4. Teste manual no Instagram in-app (iOS e Android): deve aparecer o aviso/checkout abrir no navegador externo, nunca dentro do app.

### Critério de pronto
- Abrir o link do evento pago dentro do Instagram → modal de aviso aparece; ao prosseguir, o checkout InfinitePay abre no navegador externo.

---

## FASE 8 — Relatórios (camisa + origem do pagamento)

**Pré-requisito:** Fase 6 (dados já sendo gravados).

### Backend
1. `app/api/registrations/export-admin/route.ts` e `export/route.ts`:
   - Incluir `wantsShirt`, `shirtSize` e `paymentMethod` (origem: InfinitePay/MP/Manual) no `select` e no payload.
   - **Corrigir `totalRevenue`**: somar por inscrição (`priceWithShirt` quando `wantsShirt`, senão `price`) em vez de `confirmed * event.price`.

### Frontend — UX/UI (área `app/admin/registrations`)
- **Filtro** "Camisa": Todos / Com camisa / Sem camisa. No celular, como `Segmented` ou chips.
- Coluna/etiqueta de **tamanho** e de **origem do pagamento**.
- **Impressão de listas separadas:** ação "Imprimir" com opção de gerar listas separadas — "Com camisa" (idealmente agrupada/contável por tamanho: P, M, G, GG) e "Sem camisa". Layout de impressão limpo (CSS print), legível, com totais por tamanho para facilitar a logística das camisas.

### Critério de pronto
- Filtrar com/sem camisa; imprimir as duas listas separadamente; conferir contagem por tamanho e `totalRevenue`.

---

## FASE 9 — QA / verificação end-to-end

**Pré-requisito:** todas as fases.

1. `npm run db:push && npm run db:seed` — `AppSettings` singleton `INFINITE_PAY`.
2. `npm run lint && npm run build` — sem erros de tipo/Zod.
3. Admin → Configurações (no celular): alternar gateway e confirmar persistência.
4. Criar evento pago com camisa (base, `priceWithShirt`, tamanhos P/M/G/GG).
5. Inscrição (celular): "com camisa" sem tamanho → bloqueio; com tamanho → resumo correto → checkout do gateway ativo. Simular webhook InfinitePay (`order_nsu` = id) → `CONFIRMED` + `paymentDetails`.
6. Trocar gateway para Mercado Pago e repetir (regressão do MP, com camisa).
7. Teste de navegador embutido (Instagram iOS/Android): aviso + checkout externo.
8. Relatórios: filtro com/sem camisa, impressão separada por tamanho, `totalRevenue` correto.

---

## Checklist rápido de princípios (aplicar em toda fase de front)
- [ ] Mobile-first: layout empilhado, alvos de toque ≥ 48px, valores em destaque.
- [ ] Linguagem para leigos: sem jargão, microcopy explicando cada escolha.
- [ ] Resumo do valor antes de pagar.
- [ ] Redirecionamento de pagamento sempre via `redirectToPayment` (trata navegador embutido).
- [ ] `withPrismaRetry` em toda query nova (backend).
- [ ] Origem do pagamento gravada na inscrição e visível no relatório.
