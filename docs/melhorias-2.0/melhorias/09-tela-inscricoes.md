# Requisito 9 — Melhorias na tela de inscrições

- **Status**: 🔍 RFC pronto (aguardando aprovação)
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
- [ ] Q12 respondida
- [ ] Carregamento condicionado à seleção de evento
- [ ] Ações da tabela (detalhes, data pagamento, histórico, imprimir)
- [ ] Respeito às permissões por perfil
- [ ] Testes (ver `../testes.md`)
- [ ] Documentação atualizada
- [ ] Aprovação do Ricardo

## Progresso / Arquivos alterados / Testes realizados / Pendências

_(preencher durante a implementação)_
