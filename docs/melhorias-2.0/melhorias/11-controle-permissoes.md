# Requisito 11 — Controle de permissões (Admin, Check-in, Suporte)

- **Status**: 🧪 Implementada e testada — aguardando aprovação do Ricardo
- **Ordem no roadmap**: **1ª — primeira melhoria a implementar**
- **Requisito original**: `../requisitos.md` (item 11)

## Objetivo

Sistema de perfis com dashboards próprios:

| Perfil | Pode | Não pode |
|---|---|---|
| **Admin** | Tudo | — |
| **Check-in** | Localizar inscritos; realizar check-in | Ver financeiro; editar eventos; cancelar inscrições |
| **Suporte** | Cadastrar/editar inscrições; ver inscritos; cadastrar eventos | Ver valores financeiros; ver dashboard financeiro |

## Análise preliminar (estado atual do código)

- `AdminRole` hoje: `ADMIN | SUPER_ADMIN`. Faltam `CHECKIN` e `SUPPORT` (nomes a confirmar). Definir o papel de `SUPER_ADMIN` na nova hierarquia (proposta: SUPER_ADMIN ≥ ADMIN; requisito chama de "Admin" o acesso total).
- Enforcement em **duas camadas**, ambas a alterar:
  1. `middleware.ts` (Edge): valida token e roteia por prefixo (`/admin/*`, `/checkin/*`); precisa passar a decidir por **rota × role** (ex.: Check-in acessa `/checkin/*` mas não `/admin/financial`). O role já viaja no header `x-user-role`.
  2. `BaseController` (`extractUserFromRequest`/`requireAdmin`/`requireSuperAdmin`): ganhar helper por conjunto de roles (ex.: `requireRole(...roles)`) usado em cada controller.
- **Filtragem de campos**: Suporte vê inscrições mas não valores — não basta bloquear rota; endpoints de inscrição precisam omitir campos financeiros conforme o role (serialização condicional no controller).
- Gestão de usuários (`app/admin/users`, `UserController`) ganha os novos roles; JWT emitido no login já carrega `role` — tokens antigos continuam decodificáveis.
- Dashboards por perfil: entregar aqui o **roteamento pós-login por perfil** e páginas iniciais mínimas; o dashboard rico fica para o req. 8.

## Impactos

- **Banco**: adicionar valores ao enum `AdminRole` (aditivo, seguro via `db push`).
- **Backend**: mapa central rota→roles; `requireRole` no `BaseController`; revisão de **todos** os controllers/rotas admin; serialização condicional de campos financeiros.
- **Frontend**: menu/ações condicionados ao role (`useAuth`); página `access-denied` já existe — reutilizar; telas de check-in e inscrições funcionais para os novos perfis.
- **APIs/integrações**: nenhuma externa.

## Riscos

- R-05: verificação inconsistente entre middleware e controllers → falha de autorização. Mitigar com mapa único de permissões importado dos dois lados (atenção: middleware roda no Edge — o módulo compartilhado não pode depender de Node APIs).
- Esquecer uma rota de API no enforcement — revisar lista completa de rotas em `app/api` na análise.
- Vazamento de valores financeiros para Suporte via payloads existentes (ex.: listagem de inscrições retorna `paymentDetails` hoje?) — auditar payloads.

## Análise completa (2026-07-22)

Inventário do estado atual:

- `middleware.ts`: única verificação é `role === ADMIN || SUPER_ADMIN` para toda rota protegida — sem granularidade.
- Rotas **sem verificação interna** (dependem 100% do middleware): `/api/registrations` (GET/POST/PUT/DELETE), `/api/admin/financial`, `/api/admin/dashboard`, `/api/admin/users/*` (**qualquer ADMIN gerencia usuários hoje**), `/api/checkin/*`, `/api/registrations/export*`, `/api/admin/registrations/manual`.
- Com verificação interna: `EventController` (5× `requireAdmin`), `/api/upload` (checa role inline), `/api/auth/me` (via `backend/middlewares/authMiddleware.requireAdmin` — **rejeita roles novos**, precisa ampliar).
- Tipos de role espalhados: `backend/types/auth.ts`, `lib/jwt-edge.ts`, `backend/schemas/userSchemas.ts`, `backend/repositories/AdminRepository.ts`, `hooks/useAuth.ts`, `components/admin/UserManagement.tsx`, `components/admin/UserModal.tsx`.
- `/api/registrations/stats` só retorna contagens (sem valores) — pode ser liberado a todos os perfis.
- Dashboard `/admin` (`/api/admin/dashboard`) inclui `confirmedRevenue` — filtrar por perfil.
- Login (`app/admin/login/page.tsx`) redireciona fixo para `/admin`.

## Decisões (aprovadas pelo Ricardo em 2026-07-22)

1. **4 perfis**: `SUPER_ADMIN` (tudo + gestão de usuários), `ADMIN` (tudo, exceto usuários), `CHECKIN`, `SUPPORT`. Gestão de usuários passa a ser exclusiva de SUPER_ADMIN (hoje qualquer ADMIN acessa).
2. **SUPPORT**: vê método de pagamento e observações, **nunca valores** (preços, receitas, dashboard financeiro).
3. **CHECKIN**: `/checkin` + listagem de inscritos **somente leitura** (sem valores, sem editar/cancelar/exportar).
4. **Dashboards simples por perfil já nesta melhoria** + redirecionamento pós-login por perfil (dashboard rico fica no req. 8).
5. Arquitetura: **mapa estático de permissões** em `lib/permissions.ts` (Edge-safe, importado pelo middleware E pelos controllers/frontend) — fonte única. Regra sem match em rota protegida = default deny (só ADMIN/SUPER_ADMIN). Ver ADR-002 em `../decisoes.md`.

### Matriz rota × perfil

| Rota | SUPER_ADMIN | ADMIN | SUPPORT | CHECKIN |
|---|---|---|---|---|
| `/admin` (dashboard) | ✅ | ✅ | ✅ (sem receita) | ✅ (atalhos) |
| `/admin/users` + `/api/admin/users/*` | ✅ | ❌ | ❌ | ❌ |
| `/admin/financial` + `/api/admin/financial` | ✅ | ✅ | ❌ | ❌ |
| `/admin/events` | ✅ | ✅ | ✅ | ❌ |
| `/api/events` GET/POST/PUT | ✅ | ✅ | ✅ | ❌ |
| `/api/events` DELETE | ✅ | ✅ | ❌ | ❌ |
| `/admin/registrations` | ✅ | ✅ | ✅ (sem valores) | ✅ (leitura, sem valores) |
| `/api/registrations` GET | ✅ | ✅ | ✅ (filtrado) | ✅ (filtrado) |
| `/api/registrations` POST/PUT + manual | ✅ | ✅ | ✅ | ❌ |
| `/api/registrations` DELETE | ✅ | ✅ | ❌ | ❌ |
| `/api/registrations/export*` | ✅ | ✅ | ❌ | ❌ |
| `/api/registrations/stats` | ✅ | ✅ | ✅ | ✅ |
| `/checkin` + `/api/checkin/*` | ✅ | ✅ | ❌ | ✅ |
| `/api/upload` | ✅ | ✅ | ✅ | ❌ |
| `/api/admin/dashboard` | ✅ | ✅ | ✅ (sem receita) | ✅ (contagens) |

## Plano de implementação

1. `lib/permissions.ts` novo: tipo `AdminRole`, labels, matriz de regras (prefixo + métodos HTTP → roles), `canAccessPath`, `homePathForRole`, `canViewFinancialValues`.
2. `prisma/schema.prisma`: enum `AdminRole` += `CHECKIN`, `SUPPORT` (aditivo) + `db push`.
3. `middleware.ts`: decisão por `canAccessPath(pathname, method, role)`.
4. `BaseController`: `requireRole(request, roles)`; `UserController` passa a exigir SUPER_ADMIN.
5. Ampliar tipos de role nos 7 arquivos mapeados; `authMiddleware` do `/api/auth/me` aceita os 4 roles.
6. Filtragem de campos: `/api/registrations` (GET lista e por id) omite `paymentDetails`/`paymentError`/`event.price` para SUPPORT/CHECKIN; `/api/admin/dashboard` omite receita para não-admins.
7. Frontend: `useAuth` tipado; login redireciona por perfil; dashboard `/admin` condicional por perfil; tela de inscrições esconde valores/ações por perfil; `UserManagement`/`UserModal` com os 4 perfis; AdminHeader esconde botão Check-in para SUPPORT.
8. `npm run lint` + `npx tsc --noEmit` + `npm run build` + testes manuais por perfil.

## Checklist

- [x] Análise técnica completa (inventário de rotas × roles)
- [x] Definição dos nomes de roles e papel do SUPER_ADMIN aprovada
- [x] Enum `AdminRole` atualizado + `db push` (**apenas banco local** — ver Pendências)
- [x] Mapa central de permissões (Edge-safe)
- [x] `middleware.ts` por rota × role
- [x] `BaseController.requireRole` + revisão dos controllers
- [x] Serialização condicional (campos financeiros)
- [x] Frontend (menu por perfil, gestão de usuários, redirecionamento pós-login)
- [x] Testes de autorização por perfil (33/33 PASS — ver abaixo)
- [x] Documentação atualizada
- [ ] Aprovação do Ricardo
- [ ] `db push` no Supabase antes do deploy (P-06)

## Arquivos alterados (2026-07-22)

**Novos:**
- `lib/permissions.ts` — fonte única: tipo `AdminRole`, labels, matriz rota×método×role, `canAccessPath`, `homePathForRole`, `canViewFinancialValues`. Edge-safe.
- `backend/utils/registrationSerializer.ts` — `sanitizeRegistration(s)ForRole` (remove `paymentId`/`paymentError`/`paymentDetails`/`event.price` para CHECKIN/SUPPORT).

**Backend:**
- `prisma/schema.prisma` — enum `AdminRole` += `CHECKIN`, `SUPPORT`.
- `middleware.ts` — decisão via `canAccessPath(pathname, method, role)`.
- `backend/controllers/BaseController.ts` — novo `requireRole(request, roles)`.
- `backend/controllers/UserController.ts` — guard `requireSuperAdmin` (header `x-user-role`) em todos os 7 métodos.
- `backend/controllers/EventController.ts` — create/update/stats/toggle aceitam SUPPORT; delete continua ADMIN+.
- `backend/middlewares/authMiddleware.ts` — novo `requireAuthenticated` (qualquer role válido).
- `backend/types/auth.ts`, `lib/jwt-edge.ts`, `backend/schemas/userSchemas.ts`, `backend/repositories/AdminRepository.ts` — tipos de role unificados em `AdminRole`.
- `app/api/auth/me/route.ts` — usa `requireAuthenticated`.
- `app/api/upload/route.ts` — usa `canAccessPath` (SUPPORT pode).
- `app/api/registrations/route.ts` + `[id]/route.ts` — sanitização por role no GET.
- `app/api/registrations/stats/route.ts` — receita `null` (e nem calculada) para CHECKIN/SUPPORT.
- `app/api/admin/dashboard/route.ts` — `confirmedRevenue`/`price` `null` para CHECKIN/SUPPORT.

**Frontend:**
- `hooks/useAuth.ts` — role tipado com `AdminRole`.
- `app/admin/login/page.tsx` — redirect pós-login via `homePathForRole` (CHECKIN → `/checkin`).
- `app/admin/page.tsx` — dashboard por perfil: navegação filtrada, card de receita/coluna preço/analytics só para ADMIN+, card de atalho Check-in.
- `app/admin/registrations/page.tsx` — passa `showValues`/`readOnly` (CHECKIN somente leitura).
- `components/admin/registrations/RegistrationTable.tsx` — props `showValues` (preço, botão imprimir) e `readOnly` (coluna ações, botão nova inscrição).
- `components/admin/registrations/RegistrationStats.tsx` — cards de receita só com `showValues` e valor não-nulo.
- `components/admin/registrations/RegistrationModal.tsx` — preços ocultos para SUPPORT.
- `app/admin/events/page.tsx` — botão excluir só para quem pode (DELETE).
- `components/admin/UserManagement.tsx` + `UserModal.tsx` — 4 perfis (opções, filtro, tags com `ROLE_LABELS`).
- `components/admin/AdminHeader.tsx` — botão Check-in oculto para SUPPORT.

## Testes realizados (2026-07-22)

- `npx tsc --noEmit` ✅ · `npm run lint` ✅ (só warnings pré-existentes) · `npm run build` ✅.
- Matriz de autorização executada contra servidor de produção local + Postgres Docker: **33/33 PASS** — script em scratchpad (`test-matrix.sh`), cobrindo: `/api/auth/me` para todos os perfis; usuários só SUPER_ADMIN (**ADMIN agora recebe 403** — mudança intencional); financeiro 403 para CHECKIN/SUPPORT; inscrições GET 200 para todos com **payload sanitizado** (verificado `paymentDetails/paymentId/event.price` ausentes) e POST/DELETE bloqueados por perfil; export 403; stats com `totalRevenue: null` para CHECKIN/SUPPORT; eventos (SUPPORT cria/lista, não deleta; CHECKIN nada); páginas com redirect 307 para access-denied.
- Usuários de teste no banco local: `super@test.com`, `checkin@test.com`, `suporte@test.com` (senha `test123`) + seed `admin@eventremir.com`/`admin123` (role ADMIN).

## Pendências desta melhoria

- **P-06 (bloqueante para deploy)**: enum `CHECKIN`/`SUPPORT` só existe no Postgres local. Antes do deploy, aplicar no Supabase (`npx prisma db push` com `DATABASE_URL`/`DIRECT_URL` do Supabase). Mudança aditiva, segura.
- Teste manual de UI em navegador (mobile incluído) ainda não realizado — recomendado ao aprovar.
- `/api/analytics` e `PageViewController` têm `requireAdmin` comentado (pré-existente) — avaliar no req. 8.

## Descoberta operacional relevante

`.env.local` (prioridade no Next.js) aponta para o **Supabase**, enquanto `.env` aponta para o Postgres local — `npm run dev`/`start` local fala com o Supabase, mas o Prisma CLI (`db push`, seed) usa o banco local. Os testes desta melhoria foram feitos com override explícito de `DATABASE_URL` no processo. Cuidado ao testar localmente achando que está no banco local.
