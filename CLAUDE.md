# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentação normativa (leitura obrigatória)

`/docs/contexto-ia` é a **fonte oficial de verdade** deste repositório. Antes de qualquer implementação, ler `docs/contexto-ia/00_PROJECT_CONTEXT.md` e `docs/contexto-ia/08_AI_RULES.md`, e seguir o fluxo de `docs/contexto-ia/07_FEATURE_GUIDE.md`. O índice completo está em `docs/contexto-ia/README.md`. Em conflito com hábitos padrão, esses documentos prevalecem.

## Comandos

```bash
npm run dev          # Next.js dev server
npm run build        # prisma generate && next build (build de produção)
npm run start        # Servir build de produção
npm run lint         # next lint (ESLint com next/core-web-vitals + next/typescript)
npm run db:push      # prisma db push (sincroniza schema sem migration)
npm run db:seed      # tsx prisma/seed.ts (cria admin padrão)
npm run db:reset     # Reset total + reseed
npx prisma studio    # GUI do banco
```

Postgres local via `docker-compose up -d` (porta `5433`, db `eventos_remir`, user/pass `postgres/postgres`). Não há suite de testes configurada.

Path alias: `@/*` → raiz do projeto (definido em `tsconfig.json`).

## Stack

Next.js 15 (App Router) + React 19 + TypeScript strict + Prisma 6 (PostgreSQL/Supabase) + Ant Design + TailwindCSS v4 + Zod + JWT (`jose` para Edge, `jsonwebtoken` para Node) + InfinitePay + Cloudinary.

## Arquitetura

### Camadas (Controller → Repository → Prisma)

A lógica fora do Next vive em `/backend`, separada da pasta `/app`:

- `backend/controllers/` — Estendem `BaseController` (controllers/BaseController.ts), que centraliza respostas (`success`, `created`, `badRequest`, `notFound`, `conflict`, etc.), `handleError` que mapeia `ZodError` e mensagens (`"não encontrado"` → 404, `"já existe"` → 409, `"acesso negado"` → 403), `getPaginationParams`, `paginatedResponse`, e `extractUserFromRequest`/`requireAdmin`/`requireSuperAdmin` que **leem o usuário dos headers `x-user-id`/`x-user-email`/`x-user-role`** injetados pelo middleware global.
- `backend/repositories/` — Estendem `BaseRepository` (repositories/BaseRepository.ts) com CRUD genérico tipado.
- `backend/schemas/` — Zod schemas compartilhados entre frontend e backend.
- `backend/middlewares/`, `backend/utils/`, `backend/types/` — Helpers de auth/validação/erro, bcrypt, JWT (Node), data, preços de camisa (`shirtPricing`) e taxas de referência (`paymentFees`).

`/app/api/*/route.ts` deve ser fino: validar com Zod e delegar a um Controller.

### Middleware global de autenticação (`middleware.ts`)

`middleware.ts` na raiz é o ponto único de auth para rotas protegidas. Ele:

1. Lê token do header `Authorization: Bearer` ou do cookie `token`.
2. Verifica via `verifyTokenEdge` (`lib/jwt-edge.ts`, baseado em `jose` — JWT no Node usa `jsonwebtoken` em `backend/utils/jwt.ts`; **são duas implementações distintas** porque o middleware roda no Edge Runtime).
3. Em sucesso, **propaga `x-user-id`/`x-user-email`/`x-user-role`/`x-user-name` como request headers** — é assim que controllers obtêm o usuário, NÃO redecodificando o JWT.
4. Páginas protegidas (`/admin/*`, `/checkin/*`) redirecionam para `/admin/login` se não autenticadas; rotas API equivalentes retornam 401/403.

Ao adicionar nova rota protegida: incluí-la em `adminRoutes` E no `config.matcher` no fim do arquivo. Exceções públicas dentro de prefixos protegidos vão em `publicRoutes` (ex: `/api/events/active`, webhook do InfinitePay, busca por CPF para o público).

### Padrão obrigatório: `withPrismaRetry`

Supabase + Prisma em ambiente serverless perde prepared statements (`"prepared statement \"sN\" does not exist"`), causando 500s intermitentes — especialmente em `Promise.all`. **Toda operação Prisma em rotas de API deve usar o helper `withPrismaRetry` de `lib/prisma.ts`**, que detecta esse erro específico, faz `$disconnect`/`$connect` e tenta novamente uma vez:

```typescript
import { prisma, withPrismaRetry } from "@/lib/prisma";

const [items, total] = await withPrismaRetry(async () =>
  Promise.all([
    prisma.model.findMany({ where }),
    prisma.model.count({ where }),
  ]),
);
```

Detalhes em `docs/SOLUCAO_PREPARED_STATEMENTS.md`. O `prisma` exportado é singleton via `globalThis` (padrão Next.js dev).

### Schema do banco (`prisma/schema.prisma`)

Quatro modelos: `Event`, `Registration` (FK para Event, com `status` enum `PENDING|CONFIRMED|CANCELLED|PAYMENT_FAILED`, `paymentDetails` JSON, `checkedInAt`), `Admin` (`role` enum `ADMIN|SUPER_ADMIN`), e `PageView` (analytics próprio com sessionId/geo). Datasource usa tanto `DATABASE_URL` quanto `DIRECT_URL` (pooler vs direct, padrão Supabase).

### Convenção de resposta da API

```typescript
// Sucesso
{ success: true, data, message? }
// Erro
{ success: false, error, errors? }  // errors[] usado para Zod
```

Frontend assume esse envelope — preservar ao adicionar rotas.

### Frontend

`/app` é App Router puro. Layouts aninhados em `app/layout.tsx` e `app/admin/layout.tsx`. Componentes organizados por domínio em `/components/{admin,event,registration,home,ui}` mais componentes top-level específicos (RichTextEditor com Tiptap, PaymentResultPage, etc.). Hooks em `/hooks`. Não há provider global de auth — `useAuth` consome a API.

### Pagamentos

Gateway único: **InfinitePay** (Mercado Pago removido em 2026-07-22; `MERCADO_PAGO` sobrevive nos enums do Prisma só para dados históricos). Fluxo em `app/api/payments/{create-preference,status}` + webhook `app/api/payments/webhook/infinitepay` + `lib/infinitepay.ts` + `backend/services/payment/infinitePayService.ts`. O valor é sempre recalculado no servidor (`backend/utils/shirtPricing.ts`); método/parcelas são escolhidos dentro do checkout do gateway; conciliação por `order_nsu = registration.id`. Webhook é rota pública (listada em `publicRoutes` do middleware).

### Cron e deploy

`vercel.json` define cron `/api/cron/ping` a cada 6 dias (mantém o Supabase free tier acordado), região `gru1`, `maxDuration: 60s` para todas as funções de API, headers CORS abertos. Build é `prisma generate && next build` (gera client antes do build).

## Documentação interna

`/docs` contém documentação detalhada — ao mexer em áreas específicas, consultar:

- `docs/ARQUITETURA.md` — Visão geral mais detalhada
- `docs/FLUXO_INSCRICAO.md` — Fluxo de inscrição do participante (campos fixos/dinâmicos, camisa, gratuito vs. pago)
- `docs/SOLUCAO_PREPARED_STATEMENTS.md` + `docs/EXEMPLO_PRISMA_RETRY.md` — Padrão Prisma
- `docs/GUIA_DESENVOLVIMENTO.md` — Setup e padrões
- `docs/PLANO_MIGRACAO_INFINITEPAY_E_CAMISA.md` — Pagamentos (InfinitePay + camisa)
- `docs/MELHORIAS_IOS_COMPATIBILITY.md` + `docs/PLANO_ACAO_MOBILE_FIXES.md` — Quirks mobile/iOS
