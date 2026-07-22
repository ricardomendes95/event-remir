# 01 — Arquitetura

Documento normativo. Descreve a arquitetura **real** do projeto e as regras que
qualquer código novo deve seguir. Detalhes históricos em `docs/ARQUITETURA.md`.

## 1. Stack (auditada)

| Camada | Tecnologia | Observações |
|---|---|---|
| Framework | **Next.js 15.4** (App Router) + **React 19.1** | Sem Pages Router. **Não usamos Server Actions** — mutações via API Routes |
| Linguagem | **TypeScript 5 strict** | Path alias `@/*` → raiz |
| ORM/Banco | **Prisma 6** + **PostgreSQL** | Supabase em produção (`DATABASE_URL` pooler + `DIRECT_URL`); Docker local porta 5433 |
| Validação | **Zod 4** | Schemas compartilhados em `backend/schemas` |
| UI | **Ant Design 5** (+ patch React 19) + **TailwindCSS v4** | Tokens em `app/globals.css` (`@theme inline`) |
| Formulários | **Ant Design Form** (padrão dominante) | `react-hook-form` está nas deps mas não é o padrão — não introduzir em telas novas sem decisão registrada |
| Auth | **JWT próprio** — `jose` (Edge/middleware) e `jsonwebtoken` (Node) | **Não** usamos NextAuth |
| Pagamentos | **InfinitePay** (gateway único) | `lib/infinitepay.ts`, `backend/services/payment/`. Código Mercado Pago removido em 2026-07-22; o valor `MERCADO_PAGO` sobrevive apenas nos enums do Prisma para dados históricos |
| Upload | **Cloudinary** | `lib/cloudinary.ts`, `ImageUpload`, `useImageUpload` |
| Editor | **Tiptap 3** | `RichTextEditor` (descrição de eventos) |
| Outros | dayjs, lucide-react, qrcode, bcrypt | |
| Qualidade | ESLint (`next/core-web-vitals` + `next/typescript`) | **Sem Prettier configurado, sem testes** (nem Vitest/Jest/Playwright) |
| Estado | Hooks locais + contexto pontual (`SectionRefsContext`) | **Sem** React Query, **sem** Zustand — não introduzir sem decisão registrada |
| Deploy | Vercel (`gru1`, maxDuration 60s, cron 6 dias) | Build: `prisma generate && next build` |

## 2. Topologia de pastas (papel de cada uma)

```
app/            Rotas (páginas + API). API routes devem ser FINAS.
backend/        Toda a lógica de negócio do servidor.
  controllers/  Orquestração de requisição (estendem BaseController).
  repositories/ Acesso a dados (estendem BaseRepository).
  schemas/      Zod compartilhado entre front e back.
  services/     Integrações externas (ex.: payment/infinitePayService).
  utils/        Helpers de domínio (shirtPricing, paymentFees, phone, jwt...).
  middlewares/  Helpers de auth/validação/erro para uso em rotas.
  types/        Tipos do backend.
components/     Componentes React por domínio ({admin,event,registration,home,ui}).
hooks/          Hooks reutilizáveis do frontend.
contexts/       Contextos React (uso pontual).
lib/            Clientes de infraestrutura (prisma, cloudinary, gateways, jwt-edge).
utils/          Helpers do frontend (cpfValidator, paymentRedirect, slugUtils...).
types/          Tipos compartilhados do frontend.
prisma/         Schema + seed.
middleware.ts   Middleware global de autenticação (Edge).
docs/           Documentação histórica/de profundidade.
docs/contexto-ia/  Esta suíte (fonte de verdade normativa).
```

## 3. Fluxo de uma requisição de API

```
Cliente → middleware.ts (Edge: valida JWT, injeta x-user-*)
        → app/api/**/route.ts (fino: parse + delega)
        → Controller (valida com Zod, orquestra, monta resposta)
        → Repository (Prisma, sempre com withPrismaRetry)
        → PostgreSQL (Supabase)
```

### Middleware global (`middleware.ts`)

Ponto **único** de autenticação. Regras ao mexer em rotas protegidas:

1. Nova rota protegida → adicionar em `adminRoutes` **e** no `config.matcher`.
   **Atenção**: o matcher é uma lista de prefixos; uma rota fora do matcher
   fica **pública silenciosamente** (já causou exposição — ver
   `09_DECISOES_E_DEBITOS.md`).
2. Exceção pública dentro de prefixo protegido → `publicRoutes` (match exato)
   ou regex dedicada (padrão da rota dinâmica `by-slug`).
3. Em sucesso, o middleware propaga `x-user-id`/`x-user-email`/`x-user-role`/
   `x-user-name`. Controllers usam `extractUserFromRequest`/`requireAdmin`/
   `requireSuperAdmin` — **proibido** redecodificar JWT em rota/controller.
4. São **duas implementações de JWT de propósito** : `lib/jwt-edge.ts` (jose,
   Edge Runtime) e `backend/utils/jwt.ts` (jsonwebtoken, Node). Não unificar.

## 4. Padrões obrigatórios (invioláveis)

### 4.1 `withPrismaRetry` em toda operação Prisma de rota de API

Supabase + serverless perde prepared statements. **Toda** chamada Prisma em
request handlers usa o helper de `lib/prisma.ts`:

```typescript
import { prisma, withPrismaRetry } from "@/lib/prisma";
const [items, total] = await withPrismaRetry(() =>
  Promise.all([prisma.model.findMany({ where }), prisma.model.count({ where })])
);
```

Detalhes: `docs/SOLUCAO_PREPARED_STATEMENTS.md` e `docs/EXEMPLO_PRISMA_RETRY.md`.

### 4.2 Envelope de resposta da API

```typescript
{ success: true,  data, message? }              // sucesso
{ success: false, error, errors? }              // erro (errors[] p/ Zod)
```

O frontend inteiro assume esse envelope. `BaseController` já o produz — usar os
métodos dele (`success`, `created`, `badRequest`, `handleError`...), nunca
montar `NextResponse.json` manualmente em controllers.

### 4.3 Mapeamento de erros por mensagem

`BaseController.handleError` mapeia `ZodError` → 422 e mensagens contendo
`"não encontrado"` → 404, `"já existe"`/`"duplicado"` → 409,
`"não autorizado"` → 401, `"acesso negado"` → 403. Ao lançar erros de domínio,
**usar essas palavras-chave** para obter o status correto.

### 4.4 Validação dupla

Toda entrada do usuário é validada no cliente (UX) **e** revalidada/sanitizada
no servidor (segurança) com os mesmos schemas Zod de `backend/schemas`. Nunca
persistir payload cru.

### 4.5 Dinheiro e identificadores

- Valores de cobrança sempre recalculados no servidor.
- CPF/telefone persistidos só com dígitos (`backend/utils/phone.ts`,
  `utils/cpfValidator.ts`).
- `Registration.id` (cuid) é a referência de conciliação com o gateway
  (`order_nsu`).

## 5. Banco de dados

Cinco modelos (`prisma/schema.prisma`): `Event`, `Registration`, `AppSettings`
(singleton — vestigial, ver D-13 em `09`), `Admin`, `PageView`.
Campos JSON versáteis no `Event` (`dynamicFormFields`, `fixedFieldsConfig`,
`shirtConfig`, `paymentConfig` — este último vestigial do Mercado Pago) — a
forma deles é governada pelos schemas Zod em `backend/schemas`, que são a fonte
de verdade dessas estruturas. Os enums `PaymentMethod`/`PaymentGateway` mantêm
`MERCADO_PAGO` apenas por causa de registros históricos — não usar em código
novo.

Migrations: o projeto usa `prisma db push` (sem histórico de migrations).
Mudanças de schema exigem atenção redobrada em produção (Supabase).

## 6. O que NÃO existe (e não deve ser introduzido sem decisão registrada)

- Server Actions, NextAuth, React Query, Zustand, shadcn/ui, Radix, styled-components.
- Testes — introduzi-los é **desejado**, mas via decisão de stack registrada em
  `09_DECISOES_E_DEBITOS.md` (recomendação lá).
- Novos gateways de pagamento ou variação por evento do gateway. O Mercado
  Pago foi **removido** em 2026-07-22 (decisão P-01) — não reintroduzir.
