# Requisito 8 — Novo painel administrativo

- **Status**: ✅ Implementado (aguardando aprovação)
- **Ordem no roadmap**: 11ª — depois do req. 11 (dashboards por perfil, ✅)
- **Requisito original**: `../requisitos.md` (item 8)
- **RFC escrito em**: 2026-07-24

## Objetivo e escopo

Shell administrativo próprio (dashboard inicial, menu exclusivo, organização de sistema administrativo), separado dos componentes do site público.

**Fora de escopo**: reescrever as telas internas (eventos, inscrições, financeiro continuam como estão — só mudam de "moldura"); dark mode (fora de escopo por decisão registrada no `09_DECISOES_E_DEBITOS.md` §4); branding novo.

## Estado atual do código (verificado em 2026-07-24)

- `app/admin/layout.tsx` existe (layout aninhado) e as seções são `events`, `financial`, `registrations`, `users`, `login`, `access-denied` (+ `/checkin` fora do prefixo).
- `AdminHeader` (`components/admin/AdminHeader.tsx`) é a navegação atual — mistura de padrões com o site público é o incômodo relatado.
- O req. 11 já entregou: redirect pós-login por perfil, `app/admin/page.tsx` com **dashboard condicional simples** por perfil e `lib/permissions.ts` como fonte de menu possível (rota × role). O dashboard "rico" ficou explicitamente para este requisito (ADR-002, item 5).
- AntD é padrão do admin (contexto-ia `05` §2: admin 100% AntD).

## Decisões de produto/UX

- **Shell AntD clássico**: `Layout` com `Sider` colapsável (desktop) / `Drawer` (mobile) + `Header` (usuário, papel, sair) + `Content` com breadcrumb. Check-in é usado em celular no dia do evento — o shell precisa ser impecável em mobile.
- **Menu por perfil, derivado de `lib/permissions.ts`** (fonte única — nunca duplicar a matriz): SUPER_ADMIN vê tudo; ADMIN tudo menos usuários; SUPPORT: dashboard, inscrições, eventos; CHECKIN: check-in (+ inscrições leitura).
- **Dashboard por perfil** (evolução do que o req. 11 entregou):
  - ADMIN/SUPER_ADMIN: cards do evento ativo (inscritos, confirmadas/pendentes, receita resumida), atalhos, solicitações de estorno abertas (req. 12), últimas inscrições.
  - SUPPORT: mesmos cards **sem valores** + atalho "nova inscrição manual".
  - CHECKIN: atalho gigante para o check-in + progresso de presença do evento do dia.
- Login e `access-denied` ficam **fora** do shell (sem menu).

## Arquitetura proposta

- `app/admin/layout.tsx` → renderiza o novo `components/admin/shell/AdminShell.tsx` (Sider/Header/Content); rotas internas intocadas (App Router aninhado faz o resto).
- Menu: `components/admin/shell/adminMenu.ts` — lista declarativa `{ path, label, icon, roles }` validada contra `canAccessPath` (teste manual: menu nunca mostra rota que o middleware negaria).
- `AdminHeader` atual é absorvido/aposentado pelo shell (remoção após migração — nada de duas navegações).
- Dashboard: `app/admin/page.tsx` reorganizado por perfil; dados via rotas agregadoras existentes (`/api/admin/dashboard`, já sanitizada por perfil no req. 11) + contadores novos conforme necessidade (sempre `withPrismaRetry`; valores omitidos para SUPPORT no servidor, não no client).
- `/checkin` ganha o shell? **Não** na v1 — tela de check-in é standalone proposital (foco total, celular); apenas link de volta ao painel.
- Sem mudança de banco; sem rota nova obrigatória.

## Alternativas consideradas

- Biblioteca de admin pronta (refine, Ant Design Pro): dependência/framework novo sem decisão registrada (regra 9) e ROI baixo — o AntD puro cobre.
- Shell também no site público: não — fronteira `05_DESIGN_SYSTEM.md` §2 (admin AntD, institucional tokens) permanece.
- Migrar telas para o shell "aos poucos" com dois layouts convivendo: descartado — o shell é o layout do segmento `/admin/*` inteiro; convivência criaria duas navegações simultâneas.

## Riscos e mitigação

- Refatoração de moldura quebrar telas existentes → mudança é no layout, não nas páginas; testar cada seção após a troca (matriz abaixo); commits separados (shell → dashboard → limpeza).
- Menu divergir das permissões reais → menu derivado de `lib/permissions.ts` + teste por perfil (reaproveitar o script de matriz de autorização da sessão 2 para as rotas de página).
- Mobile/check-in → teste dedicado em viewport de celular (R-07).

## Perguntas abertas

- **Q15**: o dashboard de ADMIN deve mostrar dados de **um evento selecionado** (consistente com a tela de inscrições do req. 9) ou do **evento ativo mais recente** por padrão? (Recomendação: evento ativo por padrão + seletor.)

## Plano de implementação

1. `AdminShell` (Sider/Drawer/Header/Content/breadcrumb) + `adminMenu.ts` derivado de permissões.
2. Trocar `app/admin/layout.tsx` para o shell; login/access-denied fora.
3. Migrar/aposentar `AdminHeader`; varrer imports de componentes do site público dentro de `/admin` e substituir.
4. Dashboards por perfil em `app/admin/page.tsx` (+ ajustes na rota `/api/admin/dashboard` se precisar de contadores novos).
5. Teste por perfil × seção (matriz) + mobile.
6. Verificação (`tsc`/lint/build); atualizar `04_COMPONENT_LIBRARY.md` (novos componentes de shell) e este arquivo.

## Critérios de aceite / testes manuais

- 4 perfis × todas as seções: menu mostra só o permitido; navegação, breadcrumb e "sair" funcionam; nenhuma tela interna regrediu.
- Dashboard por perfil com dados reais; SUPPORT sem nenhum valor financeiro (conferir payload da API, não só a UI).
- Mobile 375px: Drawer de menu, check-in acessível em ≤ 2 toques do login do perfil CHECKIN.
- Site público visualmente intocado.

## Checklist

- [x] Análise técnica completa (2026-07-24)
- [x] Q15 respondida (ADR-003: evento ativo mais recente + seletor)
- [x] Shell administrativo (Sider/Header/menu por perfil)
- [x] Dashboard inicial por perfil
- [x] Migração das telas existentes para o novo shell
- [ ] Teste mobile (check-in) — layout responsivo implementado, falta teste visual em 375px
- [x] Testes (ver `../testes.md`)
- [x] Documentação atualizada
- [ ] Aprovação do Ricardo

## Progresso / Arquivos alterados / Testes realizados / Pendências

**Arquivos**: `components/admin/shell/AdminShell.tsx` e `adminMenu.ts` (novos); `app/admin/layout.tsx` (usa o shell); `app/admin/page.tsx` (dashboard reescrito); `app/api/admin/dashboard/route.ts` (por evento, sem receita própria); `backend/utils/financialData.ts` (novo: carga dos insumos de `revenueBreakdown`, compartilhada); `app/api/admin/financial/route.ts` (passa a usar o loader, comportamento igual); docs `04`/`05`.

**Decisões/desvios**:
- Dashboard abre no evento ativo mais recente (por `startDate`) com seletor; reaproveita a chave de sessão `admin.registrations.eventId` da tela de inscrições.
- Receita líquida e estornos abertos vêm de `buildFinancialSummary` (mesma fonte do Financeiro); para CHECKIN/SUPPORT o campo `financial` nem existe no payload. Pageviews continuam só para ADMIN+.
- `AdminHeader` NÃO foi aposentado: a tela `/checkin` é standalone (decisão do RFC) e segue usando-o; o shell cobre `/admin/*`.
- Atalho "nova inscrição manual" do SUPPORT não foi feito (o modal não abre por URL); o atalho "Inscrições" cobre.
- Vagas = limite − (PENDING + CONFIRMED), igual à regra de inscrição. Camisas por tamanho = inscrições CONFIRMED com `wantsShirt`.

**Testes**: `tsc`, `lint` (só avisos antigos) e `build` passam. Evento de teste com 5 inscrições: dashboard e Financeiro batem (líquida R$ 190 = 50 + 70 + 70; 3 confirmadas, 1 pendente) e batem com `/api/registrations/stats`; seletor troca de evento; default sem parâmetro devolve o evento ativo mais recente; payload de CHECKIN/SUPPORT sem nenhum campo de valor; páginas por perfil: SUPPORT 307 em financeiro/estornos/usuários, CHECKIN 307 em eventos/financeiro/estornos/usuários, SUPER_ADMIN 200 em tudo. Dados de teste removidos.

**Pendências**: teste visual em 375px (Drawer, check-in em ≤ 2 toques) e conferência visual das telas internas dentro da nova moldura; aprovação do Ricardo.
