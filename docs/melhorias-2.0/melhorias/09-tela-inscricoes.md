# Requisito 9 — Melhorias na tela de inscrições

- **Status**: ✅ Implementado (aguardando aprovação do Ricardo)
- **Ordem no roadmap**: 7ª — depois do req. 1 (observação/método manual)
- **Requisito original**: `../requisitos.md` (item 9)
- **RFC escrito em**: 2026-07-24

## Objetivo e escopo

1. Carregar dados **somente após** a seleção de um evento (hoje a tela busca tudo com filtro `ALL` no mount).
2. Ações por linha: **ver detalhes**, **data do pagamento**, **histórico**, **imprimir comprovante**.

**Fora de escopo**: redesenho geral do admin (req. 8); trilha de auditoria completa de alterações (ver decisão D3).

## Estado atual do código (verificado em 2026-07-24)

- `app/admin/registrations/page.tsx` (749 linhas): busca inscrições + stats no mount com `eventId=ALL`; filtros em `RegistrationFilters`; tabela em `RegistrationTable` (já com `showValues`/`readOnly` por perfil — ADR-002); impressão de **relatório** já existe (`RegistrationsPrintReport`, com listas por tamanho de camisa).
- Data do pagamento: só dentro de `Registration.paymentDetails` JSON (`dateProcessed` no formato do webhook InfinitePay; formatos legados MP variam — R-03). O serializer (ADR-002) **remove** `paymentDetails` para CHECKIN/SUPPORT — a data precisa ser derivada no servidor como campo próprio (não é valor financeiro).
- Comprovante individual: `RegistrationProofModal` (público, com QR) — base para a impressão por linha.
- `GET /api/registrations/[id]` já retorna a inscrição completa sanitizada por perfil.

## Decisões de produto/UX

- Estado inicial: seletor de evento em destaque + estado vazio ("Selecione um evento para ver as inscrições"). O filtro "Todos os eventos" deixa de ser o default; permanece disponível? **Não** — o requisito pede explicitamente carregar só após seleção (menos dados, menos custo). Última seleção lembrada por sessão (`sessionStorage`).
- Detalhes em **Drawer** lateral (AntD) — funciona bem em mobile e não perde o contexto da tabela: dados completos, campos dinâmicos, camisa, pagamento (método, sub-método manual e observação do req. 1), datas.
- **D3 — Histórico (escopo)**: v1 = **linha do tempo derivada** dos dados existentes (inscrição criada → pagamento confirmado (data derivada) → check-in → cancelamento/estorno (req. 12) → alterações? só `updatedAt`). **Sem tabela de auditoria de alterações** — custo alto, valor incerto; se a demanda real aparecer, vira proposta própria em `../decisoes.md`.
- Imprimir comprovante: reaproveita a renderização do `RegistrationProofModal` com CSS `@media print` (janela de impressão) — sem PDF, sem dependência nova.

## Arquitetura proposta

- **Backend**:
  - `GET /api/registrations` e `[id]`: derivar `paymentDate` no servidor (função util `resolvePaymentDate(paymentDetails)` tolerante aos formatos legados) e expô-la fora de `paymentDetails`, para que CHECKIN/SUPPORT também vejam (data não é valor — consistente com ADR-002).
  - `GET /api/registrations` já aceita `eventId` — nenhum endpoint novo para o carregamento condicionado; o frontend simplesmente não chama sem `eventId`.
  - Histórico: montado no client a partir do payload existente + (quando req. 12 existir) solicitações de estorno da inscrição.
- **Frontend** (`app/admin/registrations/page.tsx` + componentes):
  - Gate de seleção de evento (novo estado + empty state); stats também condicionadas ao evento.
  - `RegistrationTable`: menu de ações por linha (Detalhes · Imprimir comprovante · já existentes Editar/Excluir conforme perfil).
  - Novo `RegistrationDetailDrawer` em `components/admin/registrations/` (respeita `showValues`).
  - Impressão individual: componente de comprovante compartilhado com o público (extrair o miolo do `RegistrationProofModal` para reuso — regra "nunca criar variação paralela", `07_FEATURE_GUIDE.md` §4).

## Alternativas consideradas

- Tabela de auditoria de alterações (quem editou o quê): adiada (D3) — ver acima.
- Modal em vez de Drawer para detalhes: Drawer escolhido (mobile, scroll longo de campos dinâmicos).
- Gerar PDF do comprovante: descartado — `@media print` resolve sem dependência nova (regra 9).

## Riscos e mitigação

- Formatos legados de `paymentDetails` sem data reconhecível → `paymentDate = null`, exibir "—" (nunca quebrar).
- Vazamento de valores para SUPPORT/CHECKIN no Drawer/na impressão → Drawer usa o payload já sanitizado; comprovante impresso não tem valores? **Tem** (comprovante público mostra valor pago) → impressão de comprovante disponível só para perfis com `showValues`? Ver Q12.
- Perda de fluxo do admin acostumado com "todos os eventos" → seleção lembrada + UX clara.

## Perguntas abertas

- **Q12**: SUPPORT pode imprimir comprovante (que exibe o valor pago)? (Recomendação: sim — o comprovante é o mesmo documento público que o participante já vê; o bloqueio de valores do ADR-002 é para telas administrativas agregadas. Confirmar.)

## Plano de implementação

1. Util `resolvePaymentDate` + exposição de `paymentDate` nas rotas de listagem/detalhe (com teste manual contra dados legados reais).
2. Gate de seleção de evento na página (+ sessionStorage, empty state, stats condicionadas).
3. Extração do miolo do comprovante para componente compartilhado; ação "Imprimir comprovante" por linha.
4. `RegistrationDetailDrawer` (detalhes + linha do tempo).
5. Menu de ações na `RegistrationTable` por perfil.
6. Verificação (`tsc`/lint/build) + matriz abaixo; atualizar documentação.

## Critérios de aceite / testes manuais

- Abrir a tela → nenhuma requisição de inscrições antes de escolher evento; após escolher, tabela/stats do evento.
- Detalhes: todos os campos, inclusive observação/método manual (req. 1) e camisa; SUPPORT vê tudo menos valores; CHECKIN somente leitura.
- Data do pagamento correta para inscrição InfinitePay nova; "—" para legado sem data; histórico coerente.
- Imprimir comprovante gera versão idêntica à do participante (conforme Q12).
- Mobile 375px: drawer e ações utilizáveis.

## Checklist

- [x] Análise técnica completa (2026-07-24)
- [x] Decisão sobre escopo do "histórico" → linha do tempo derivada, sem tabela de auditoria (D3)
- [x] Q12 respondida (ADR-003: SUPPORT imprime o comprovante, documento público)
- [x] Carregamento condicionado à seleção de evento
- [x] Ações da tabela (detalhes, data pagamento, histórico, imprimir)
- [x] Respeito às permissões por perfil
- [x] Testes (ver `../testes.md`)
- [x] Documentação atualizada
- [ ] Aprovação do Ricardo

## Progresso / Arquivos alterados / Testes realizados / Pendências

**Implementação (2026-11-11)**

- Gate de evento: sem evento escolhido, nenhuma chamada de inscrições/estatísticas; empty state; último evento lembrado em `sessionStorage`; "Todos os eventos" removido. Eventos carregados com `limit=100`.
- Filtros (server-side, `backend/utils/registrationFilters.ts`, compartilhado entre listagem e `stats`): status, **lote** (inclui "Sem lote"), **pagamento** (InfinitePay/Manual/Gratuito), **individual/grupo**, busca e "Limpar filtros". Estados de loading, vazio e erro (com "Tentar novamente").
- `paymentDate` derivada no servidor (`backend/utils/paymentDate.ts`, tolerante a legado; `null` => "—") e exposta em `GET /api/registrations` e `[id]` para todos os perfis, fora de `paymentDetails`.
- `RegistrationDetailDrawer`: dados completos, lote, grupo/responsável, camisa, pagamento (método, sub-método, responsável, observação conforme perfil), campos dinâmicos e linha do tempo (criada, paga, check-in, solicitações de estorno, última alteração). Histórico de estorno só para ADMIN/SUPER_ADMIN.
- Comprovante: miolo da impressão extraído para `lib/registrationProofPrint.ts` (usado pelo comprovante público e pela ação "Imprimir comprovante" da linha, que usa a mesma rota pública `get-by-id`) => documento idêntico, inclusive para SUPPORT/CHECKIN (Q12).
- Req. 12: botão **Cancelar**/**Reativar** por linha (só ADMIN/SUPER_ADMIN; cancelamento gera `RefundRequest` administrativa, reativação exige vaga e mostra o 409 do servidor), tag "Estorno em aberto" na linha e no drawer, card "Estornos em aberto" nas estatísticas. O seletor de status deixou de oferecer Cancelado (usa o botão dedicado) e fica desabilitado em inscrição cancelada; Excluir só para ADMIN+ (antes SUPPORT via 403).
- Req. 1: `export-admin` e a impressão da lista incluem pagamento (sub-método/responsável) e observação (observação omitida se o perfil não puder ver); `RegistrationStats` mostra contagem de manuais por sub-método e "com observação" (CHECKIN não recebe `withNotes`). `/api/admin/registrations/manual` e `ManualRegistrationModal` removidos (nenhum uso na UI; confirmado por grep) junto com a regra em `lib/permissions.ts`.
- Mobile: filtros em grid responsivo; tabela com rolagem horizontal e coluna de ações fixa à direita.

**Desvios do RFC**: histórico sem tabela de auditoria (D3, como previsto); detalhes usam o payload da listagem (sem chamada extra a `[id]`); impressão da lista (`export-admin`) continua só ADMIN+ por conter receita.

**Arquivos**: `app/admin/registrations/page.tsx`; `app/api/registrations/{route,[id]/route,stats/route,export-admin/route}.ts`; `backend/utils/{paymentDate,registrationFilters}.ts`; `lib/{registrationProofPrint,registrationPaymentLabel,permissions}.ts`; `components/RegistrationProofModal.tsx`; `components/admin/RegistrationsPrintReport.tsx`; `components/admin/registrations/*` (Table, Filters, Stats, Modal, novo Drawer e `types.ts`).

**Testes (servidor local :3111, super/checkin/suporte)**: filtros (pagamento, grupo, lote, status; valor inválido ignorado); `paymentDate` presente para os 3 perfis e `null` para manual; CHECKIN sem preço/`paymentId`/observação/responsável; SUPPORT com observação e responsável, sem valores; stats sem receita para CHECKIN/SUPPORT e `withNotes` nulo para CHECKIN; `export-admin` 403 para SUPPORT/CHECKIN e com campos novos para admin; cancelar/reativar 403 para SUPPORT, ok para SUPER_ADMIN (RefundRequest ADMIN/OPEN criada e depois WITHDRAWN); `get-by-id` (comprovante) devolve o documento completo. Dados de teste removidos.

**Pendências**: validação visual em navegador (375px: drawer, filtros e tabela) e da janela de impressão; reativação sem vaga (409) só validada por leitura do código.
