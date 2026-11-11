# 00 — Contexto do Projeto (documento principal)

## 1. Propósito do sistema

**Event Remir** é o sistema de inscrições para eventos da igreja Remir. Ele
permite que qualquer pessoa — independentemente do nível de familiaridade com
tecnologia — se inscreva em um evento em poucos passos, pague (quando o evento é
pago) e receba um comprovante. Para a equipe da igreja, oferece um painel
administrativo completo: criação de eventos, gestão de inscrições, relatórios,
financeiro, check-in no dia do evento e analytics de visitas.

## 2. Visão do produto

O produto existe para **converter intenção em inscrição**. Cada clique, campo ou
tela desnecessária representa uma possível desistência. Toda evolução deve
priorizar, nesta ordem:

1. **Simplicidade** — menos passos, menos campos, linguagem simples.
2. **Clareza** — o usuário sempre sabe onde está, o que falta e o que aconteceu.
3. **Velocidade** — telas leves, respostas imediatas, conexões lentas suportadas.
4. **Confiança** — feedback claro, comprovante imediato, recuperação de erros
   (ex.: "continuar pagamento").
5. **Acessibilidade** — funciona para idosos, crianças acompanhadas e pessoas
   com pouca leitura digital.
6. **Conversão** — medida por inscrições concluídas, não por páginas vistas.

## 3. Público-alvo

- **Participante (público)**: membros e visitantes da igreja, todas as idades,
  perfil majoritariamente **mobile**. Chegam via link compartilhado no
  **WhatsApp/Instagram** — frequentemente dentro de navegadores embutidos
  (o sistema já trata isso com `EmbeddedBrowserWarningModal` e
  `utils/paymentRedirect.ts`). Muitos têm baixa familiaridade com tecnologia.
- **Admin (`ADMIN`)**: voluntários/secretaria da igreja. Gerenciam eventos,
  inscrições e check-in.
- **Super Admin (`SUPER_ADMIN`)**: responsável técnico. Além do que o admin faz,
  gerencia os usuários administrativos.

## 4. Módulos existentes

### Área pública
- **Home institucional** (`app/page.tsx`): hero, sobre, pastores, ministérios,
  localização.
- **Listagem de eventos** (`/eventos`) e **página do evento** (`/eventos/[slug]`,
  com SEO: `sitemap.ts`, `robots.ts`, `StructuredData`).
- **Inscrição**: modal multi-etapas (`EventRegistrationModal`) — o coração do
  produto.
- **Comprovante**: busca por CPF (`SearchComprovante`) e modal de comprovante
  com QR code (`RegistrationProofModal`), exibido automaticamente após inscrição.
- **Páginas de retorno de pagamento**: `/payment/{success,pending,failure}`.

### Pagamentos
- **Gateway único: InfinitePay** (checkout externo; Pix grátis + crédito).
  Conciliação via `order_nsu = registration.id` no webhook
  `/api/payments/webhook/infinitepay`.
- **Mercado Pago foi removido do código em 2026-07-22** (decisão P-01). O valor
  `MERCADO_PAGO` permanece nos enums do Prisma e em telas de exibição apenas
  para inscrições históricas — nunca em fluxo novo.

### Painel administrativo (`/admin`)
- Dashboard com métricas reais + analytics de page views.
- CRUD de eventos (`EventModal`, com editor rich text Tiptap, upload de banner
  via Cloudinary, construtor de formulário dinâmico, config de camisa).
- Gestão de inscrições (filtros, edição, inscrição manual, exportação,
  relatórios de impressão com listas por tamanho de camisa).
- Financeiro (`/admin/financial`).
- Usuários (`/admin/users`, restrito por papel).

### Check-in (`/checkin`)
- Busca de inscritos, marcação de presença (`checkedInAt`), relatório de
  impressão.

### Infra
- **Analytics próprio**: modelo `PageView` (sessionId, geo, referrer) via
  `PageTracker`/`usePageTracking` — sem Google Analytics. Só coleta após
  consentimento LGPD (`PrivacyConsent`); política pública em `/privacidade`.
- **Cron** (`vercel.json`): `/api/cron/ping` a cada 6 dias mantém o Supabase
  free tier ativo. Região `gru1`, `maxDuration` 60s.

## 5. Fluxo completo de inscrição (resumo normativo)

Detalhe completo e autoritativo em `docs/FLUXO_INSCRICAO.md`.

1. Usuário abre a página do evento e toca em inscrever-se → abre o
   `EventRegistrationModal`.
2. **Etapa Dados**: nome e CPF sempre obrigatórios; e-mail/telefone obrigatórios
   em evento pago, configuráveis em gratuito (`fixedFieldsConfig`); campos
   dinâmicos (até 30, 8 tipos) conforme `formMode`
   (`FIXED_ONLY | BOTH | DYNAMIC_ONLY`).
3. Ao digitar o CPF, `useCpfVerification` checa duplicidade:
   - `CONFIRMED` → bloqueia nova inscrição, oferece comprovante.
   - `PENDING`/`CANCELLED`/`PAYMENT_FAILED` → oferece **continuar pagamento**
     (o backend faz UPDATE, nunca cria duplicata; permite trocar opção de camisa).
4. **Evento gratuito**: etapa de confirmação → `POST /api/registrations/create-free`
   → `Registration` já `CONFIRMED` com `paymentMethod = FREE` → comprovante
   imediato. Sem redirecionamento externo.
5. **Evento pago**: etapa Pagamento mostra valor (e opção de camisa se
   habilitada: dois cartões, sem/com camisa; tamanho obrigatório se "com") →
   `POST /api/payments/create-preference` → cria `Registration` `PENDING`
   **antes** do checkout (o `id` vira `order_nsu`) → redireciona para o checkout
   InfinitePay (com fallback manual para iOS/navegadores embutidos).
6. Webhook do gateway confirma o pagamento → `status = CONFIRMED`. O InfinitePay
   **só notifica aprovação** (não há `PAYMENT_FAILED` automático).

### Regras de negócio invioláveis

- CPF é gravado **só com dígitos** e é a **chave de deduplicação por evento**.
- **Valores são sempre recalculados no servidor** (`resolveBaseValue`,
  `validateShirtSelection` em `backend/utils/shirtPricing.ts`). Nunca confiar em
  preço vindo do cliente.
- **Camisa só em evento pago**; `priceWithShirt > price`; tamanho obrigatório
  quando "com camisa". Persistida em campos dedicados (`wantsShirt`,
  `shirtSize`), nunca em `dynamicFormData`.
- **`DYNAMIC_ONLY` só em evento gratuito**; evento pago admite só `FIXED_ONLY`
  ou `BOTH` (defesa em profundidade na rota paga).
- Formulário dinâmico: cliente valida (AntD), servidor **revalida e sanitiza**
  (`validateDynamicFormData`); só o objeto sanitizado é persistido.
- Gates de disponibilidade sempre revalidados no servidor: `isActive`, janela
  (`registrationStartDate`–`registrationEndDate`), vagas (`maxParticipants`) e,
  em evento com lotes, lote vigente.
- **Vagas** (globais e por lote) contam só inscrições `PENDING` + `CONFIRMED`;
  `CANCELLED`/`PAYMENT_FAILED` liberam a vaga (`OCCUPYING_STATUSES`).
- **Lotes** (`EventBatch`, opcionais, só em evento pago): o lote vigente
  (`resolveActiveBatch`: ativo + período + vaga; menor `priority` vence) define o
  preço — `resolveBaseValue(event, wantsShirt, batch)`. A inscrição guarda o
  `batchId`; webhook e relatórios usam o lote da inscrição; ao continuar
  pagamento cobra-se o lote vigente e o `batchId` é atualizado. Evento sem lotes
  segue com preço único. Detalhe em `docs/FLUXO_INSCRICAO.md`.
- **Inscrição em lote** (`Event.allowBatchRegistration`, default `false`): até
  `MAX_BATCH_SIZE = 10` participantes em uma compra, um pagamento. `Order` 1:N
  `Registration` (`orderId`); `order_nsu = "ord_" + order.id` (o individual segue
  `registration.id`, intocado). Rotas: `create-batch-preference`,
  `create-free-batch`, `update-batch-preference`, `registrations/{id}/leave-order`.
  Vagas (global e quota do lote) são checadas para N participantes dentro de
  `$transaction` com lock (`lockRow`, `FOR UPDATE`). Webhook `ord_` é idempotente,
  valida o total recalculado e recusa link obsoleto. Detalhe em
  `docs/FLUXO_INSCRICAO.md`.
- Webhook InfinitePay não tem assinatura/HMAC (limitação do produto): validação
  = `order_nsu` corresponde a `Registration` real + `paid_amount` cobre o valor
  recalculado. Não inventar secret.

## 6. Papéis e permissões

| Papel | Acesso |
|---|---|
| Público | Home, eventos, inscrição, comprovante por CPF, páginas de pagamento |
| `ADMIN` | Tudo do público + `/admin/*` (exceto gestão de usuários) + `/checkin` |
| `SUPER_ADMIN` | Tudo + `/admin/users` (gestão de administradores) |

Autenticação: JWT próprio (cookie `token` ou `Authorization: Bearer`),
verificado no **middleware global** (`middleware.ts`, Edge) que injeta
`x-user-id`/`x-user-email`/`x-user-role`/`x-user-name` nos request headers.
Controllers leem esses headers — **nunca** redecodificam o JWT.

## 7. Princípios de UX do projeto

Ver `06_UX_PRINCIPLES.md`. Resumo: **mobile first sempre**; máximo de 2–3 etapas
em qualquer fluxo público; linguagem do usuário ("Ir para o pagamento", nunca
"Submeter preferência"); feedback imediato em toda ação; nunca perder o trabalho
do usuário (continuar pagamento é o exemplo canônico); teclado virtual correto
por campo; máscaras em CPF/telefone.

## 8. Visão de evolução futura

- Reduzir fricção do fluxo de inscrição continuamente (meta: inscrever-se em
  menos de 60 segundos no mobile).
- Consolidar o design system (hoje AntD + Tailwind + tokens em
  `app/globals.css`) e eliminar cores hardcoded.
- **Inscrição em lote (família/grupo) é a próxima feature do roadmap**
  (decisão P-04 em 2026-07-22; análise de viabilidade e RFC em
  `docs/RFC_INSCRICAO_EM_LOTE.md`).
- Notificações via WhatsApp: estudada (RFC em `/docs`), **sem aprovação** —
  comprovante em tela + busca por CPF permanecem o padrão (decisão P-03).
- Introduzir testes automatizados (hoje inexistentes) começando pelas rotas de
  pagamento e inscrição — ver `09_DECISOES_E_DEBITOS.md`.
