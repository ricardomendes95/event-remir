# 03 — Diretrizes de Frontend

Normativo. Regras para páginas, layouts, componentes, formulários, hooks e
estado. Complementa `04_COMPONENT_LIBRARY.md` (catálogo) e
`05_DESIGN_SYSTEM.md` (visual).

## 1. Páginas e layouts (`/app`)

- App Router puro. Layout raiz `app/layout.tsx` (AntdProvider, PageTracker,
  fontes, SEO) e `app/admin/layout.tsx` (chrome do admin).
- O padrão dominante do projeto é **Client Component + fetch à API interna**
  (`useEffect`/hooks), consumindo o envelope `{ success, data }`. Páginas
  públicas sensíveis a SEO (`/eventos/[slug]`) usam Server Component para
  metadata e delegam interação a um componente cliente (`EventPageContent`).
- **Regra**: Server Component por padrão para conteúdo estático/SEO; `"use
  client"` só onde há interação. Não converter páginas existentes sem motivo.
- **Não usamos Server Actions** — mutações passam pelas API Routes (mantém o
  middleware como ponto único de auth).
- Toda página nova deve nascer **mobile first** (ver `06_UX_PRINCIPLES.md`).

## 2. Estrutura padrão de uma tela nova

1. Rota em `app/...` (Server Component fino com metadata quando público).
2. Conteúdo interativo em componente de domínio em
   `components/<domínio>/`.
3. Busca de dados em **hook dedicado** em `/hooks` se houver estado/refetch
   reutilizável; fetch inline só para casos triviais.
4. Formulários com **Ant Design Form** + validação espelhando o schema Zod do
   backend (importado de `@/backend/schemas` quando aplicável).
5. Estados obrigatórios: loading (Skeleton/Spin), empty (Empty com ação),
   erro (message/Alert com recuperação), sucesso (feedback imediato).

## 3. Componentes

- Organização por domínio: `components/{admin,event,registration,home,ui}` +
  top-level para peças transversais. Novos componentes seguem essa taxonomia.
- **Antes de criar, consultar `04_COMPONENT_LIBRARY.md`** — reutilizar sempre
  que existir similar. Duplicação de componente é defeito de revisão.
- Componente reutilizável **não** conhece rota nem faz fetch — recebe dados e
  callbacks por props. Fetch mora na página/hook.
- Barrel files (`index.ts`) já existem em `admin`, `registration`,
  `admin/registrations` — manter o padrão ao adicionar.
- Nomenclatura: PascalCase; sufixos consistentes (`*Modal`, `*Form`, `*Table`,
  `*Section`).

## 4. Formulários (padrão obrigatório)

- **Ant Design Form** é o padrão (não introduzir react-hook-form em telas novas
  — ver débito em `09_DECISOES_E_DEBITOS.md`).
- Inputs mobile: `inputMode`/`type` corretos (numérico para CPF/telefone),
  máscaras nos campos brasileiros (CPF `000.000.000-00`, telefone
  `(00) 00000-0000`) — persistir **só dígitos**.
- Mensagens de validação em português simples, apontando a correção ("Digite um
  CPF válido"), nunca jargão técnico.
- Campos dinâmicos de evento: renderização **exclusivamente** via
  `DynamicFormRenderer` (nunca reimplementar), construção no admin via
  `DynamicFormBuilder`.
- Dinheiro: entrada via `MoneyInput`; exibição sempre com formatação segura
  (cuidado com iOS — ver `docs/MELHORIAS_IOS_COMPATIBILITY.md`).

## 5. Hooks (`/hooks`)

Catálogo atual — reutilizar antes de criar:

| Hook | Responsabilidade |
|---|---|
| `useAuth` | Sessão do admin (login/logout/me) — não há provider global |
| `useCpfVerification` | Dedup de inscrição por CPF/evento + estados do alerta |
| `useDeviceDetection` | iOS/Android/embedded browser (base dos fallbacks de redirect) |
| `useEventValidation` | Schema + tipos do formulário de evento (admin) |
| `useImageUpload` | Upload Cloudinary com estados |
| `usePageTracking` | Analytics próprio (PageView) |
| `useUsers` | CRUD de admins |

**Regra**: lógica com estado usada por 2+ componentes → hook. Hook não renderiza
JSX. Nomes `useXyz`.

## 6. Comunicação com a API

- Sempre tratar o envelope: checar `res.ok` **e** `body.success`; exibir
  `body.error` ao usuário e `body.errors[]` campo a campo quando presente.
- Auth: o cookie `token` viaja automaticamente; não montar headers Authorization
  manualmente no browser (padrão do projeto).
- Redirecionamento a checkout externo: **exclusivamente** via
  `utils/paymentRedirect.ts` (`redirectToPayment`), que trata navegadores
  embutidos (Instagram/WhatsApp) e oferece fallback manual. Nunca
  `window.location` direto para gateway.

## 7. Estado global

Não há store global e isso é intencional (escala atual não exige). Estado de
servidor: hooks locais. Estado cruzado pontual: contexto React
(`SectionRefsContext` é o exemplo). Introduzir React Query/Zustand só com
decisão registrada.

## 8. Performance

- Imagens: `next/image` / Cloudinary com transformação (nunca `<img>` com
  original pesado).
- Componentes pesados (RichTextEditor, relatórios de impressão) via `dynamic
  import` quando fora do caminho crítico.
- Público-alvo tem conexão lenta: evitar dependência nova no bundle público sem
  justificativa; o fluxo de inscrição é o caminho crítico de performance.
