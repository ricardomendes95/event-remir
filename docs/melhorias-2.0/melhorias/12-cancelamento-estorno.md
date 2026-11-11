# Requisito 12 — Cancelamento e estorno

- **Status**: 🧪 Implementada e testada no banco local — aguardando aprovação do Ricardo
- **Ordem no roadmap**: 5ª — depois de permissões (req. 11, ✅)
- **Requisito original**: `../requisitos.md` (item 12)
- **RFC escrito em**: 2026-07-24

## Objetivo e escopo

Fluxo completo de cancelamento: participante **solicita** pelo comprovante; admin **acompanha** em uma tela de solicitações, **entra em contato** via WhatsApp, **cancela** a inscrição e **registra o estorno**; desistência **reativa** a inscrição sem duplicidade (CPF como chave).

**Fato decisivo (P-04, pesquisado em 2026-07-24)**: a API pública do InfinitePay **não tem endpoint de estorno** — estorno/cancelamento de venda é operação manual no app InfinitePay (exige saldo; Pix reembolsável em até 90 dias, total ou parcial). Logo, **estorno automático está fora de escopo por impossibilidade técnica**; o fluxo é **manual assistido**: o sistema organiza solicitações, guia o admin e registra o que foi feito fora.

## Estado atual do código (verificado em 2026-07-24)

- `RegistrationStatus.CANCELLED` existe e o admin já consegue setar status pelo `RegistrationModal` — mas não há fluxo de solicitação, motivo, nem registro de estorno.
- Comprovante público: busca por CPF (`app/api/registrations/search-by-cpf`, rota pública no middleware) + `RegistrationProofModal`. O botão "Solicitar cancelamento" entra aí.
- `create-preference` já trata inscrição `CANCELLED` como reaproveitável (UPDATE, nunca duplica) — a **reativação por pagamento** pedida no requisito já funciona para inscrição não paga; falta a reativação administrativa de inscrição já paga.
- Telefone: normalizado E.164 (+55) no checkout (commit `f69fe88`) — reutilizar para o link `wa.me`.
- Permissões (`lib/permissions.ts`, ADR-002): CHECKIN/SUPPORT não veem valores; requisito 11 já definiu que eles **não cancelam** inscrições.

## Decisões de produto/UX

- Solicitação exige **motivo** (texto curto obrigatório — o admin precisa dele para o contato) e confirma com mensagem de sucesso simples ("Recebemos sua solicitação. Entraremos em contato pelo WhatsApp.").
- **Uma solicitação aberta por inscrição** (idempotência): nova tentativa com solicitação aberta → mensagem "já recebemos sua solicitação".
- O participante pode **desfazer a solicitação** pelo próprio comprovante enquanto ela estiver aberta ("Desistir do cancelamento") — cobre a desistência sem envolver o admin quando nada foi estornado ainda.
- Cancelar a inscrição **não** é automático ao solicitar — decisão fica com o admin após contato (dinheiro real envolvido).
- Botão "Entrar em contato": `https://wa.me/55<telefone>?texto` com mensagem pronta citando nome, evento e motivo (P-05: usa o telefone do participante).

## Arquitetura proposta

### Máquina de estados (três estados distintos, nunca misturar)

- **Solicitação** (`RefundRequest.status`): `OPEN → IN_CONTACT → RESOLVED (refunded | denied | withdrawn)`.
- **Inscrição** (`Registration.status`): `CONFIRMED → CANCELLED` (e de volta, na reativação). Sem valor novo no enum — estorno não é status de inscrição.
- **Transação/pedido**: registro do estorno em campos dedicados (abaixo) e, quando existir `Order` (ADR-001), no `paymentDetails.history[]` do pedido.

### Schema (aditivo)

```prisma
model RefundRequest {
  id             String    @id @default(cuid())
  registrationId String
  registration   Registration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  reason         String    @db.Text
  status         RefundRequestStatus @default(OPEN)
  resolution     RefundResolution?     // REFUNDED | DENIED | WITHDRAWN (quando RESOLVED)
  adminNotes     String?   @db.Text
  refundedAmount Float?                // registrado pelo admin ao concluir estorno
  refundedAt     DateTime?
  resolvedById   String?               // Admin.id de quem resolveu
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([registrationId])
  @@index([status])
  @@map("refund_requests")
}

enum RefundRequestStatus { OPEN IN_CONTACT RESOLVED }
enum RefundResolution { REFUNDED DENIED WITHDRAWN }
```

Sem campos novos em `Registration`: cancelamento continua sendo `status = CANCELLED`; o "porquê/quando/quem" vive na `RefundRequest` (fonte de auditoria). Cancelamento administrativo direto (sem solicitação do participante) **cria** uma `RefundRequest` com origem admin? Não — ver Q7.

### Rotas

| Rota | Acesso | Função |
|---|---|---|
| `POST /api/registrations/[id]/refund-request` | **pública** (validada por CPF no body — mesma superfície da busca por CPF) | cria solicitação (motivo obrigatório; 409 se já houver aberta) |
| `DELETE /api/registrations/[id]/refund-request` | pública (CPF no body) | desistência: marca `RESOLVED/WITHDRAWN` se ainda `OPEN`/`IN_CONTACT` |
| `GET /api/admin/refund-requests` | ADMIN/SUPER_ADMIN | lista com filtros (status, evento) |
| `PATCH /api/admin/refund-requests/[id]` | ADMIN/SUPER_ADMIN | transições: contato feito, negar, registrar estorno (valor + data), reabrir |
| Cancelar/reativar inscrição | ADMIN/SUPER_ADMIN | já existe via PUT de registration; ganha ação dedicada na tela de solicitações |

Rotas novas admin entram em `adminRoutes` **e** `config.matcher`; as públicas em `publicRoutes` com justificativa (regra dura 3). Todas com Zod + `withPrismaRetry` + envelope padrão.

**Proteção da rota pública**: exige CPF que confira com a inscrição; uma solicitação aberta por inscrição; corpo mínimo; sem eco de dados pessoais na resposta. (Rate limiting global é débito conhecido — `09_DECISOES_E_DEBITOS.md` §4.)

### Fluxo do estorno manual assistido

1. Admin abre "Solicitações de estorno" (`/admin/refund-requests` — página nova, ou aba no financeiro; ver Q8): tabela com participante, evento, valor pago (calculado por `resolveBaseValue`/Order), motivo, data, status, botões **WhatsApp**, **Marcar em contato**, **Negar**, **Cancelar inscrição + registrar estorno**.
2. Ao registrar estorno: modal pede valor estornado (pré-preenchido) e confirmação explícita ("você já fez o estorno no app InfinitePay?"); grava `refundedAmount/refundedAt/resolvedById`, seta `Registration.status = CANCELLED` na mesma transação.
3. Financeiro (req. 10) e auditoria (req. 6) leem `RefundRequest` resolvidas como saídas/estornos.

### Reativação (desistência após cancelamento)

- Solicitação aberta + inscrição ainda `CONFIRMED` → participante desiste sozinho (rota pública acima). Nada mais a fazer.
- Inscrição já `CANCELLED` mas **não estornada** → admin reativa: `status = CONFIRMED` (pagamento continua válido) + solicitação `RESOLVED/WITHDRAWN`.
- Inscrição cancelada **e estornada** → participante precisa pagar de novo: o fluxo público existente já resolve (CPF encontra a inscrição `CANCELLED` → "continuar pagamento" → UPDATE, nunca duplica — exigência do requisito atendida pelo comportamento atual de `create-preference`).

## Alternativas consideradas

- **Estorno automático via API**: impossível hoje (P-04). Se o InfinitePay lançar endpoint, entra como fase 2 — a máquina de estados já comporta (`RESOLVED/REFUNDED` passa a ser preenchido pela integração).
- **Status de inscrição `REFUNDED` no enum**: descartado — todas as telas/filtros assumem os 4 valores atuais; estorno é atributo da solicitação/transação, não um 5º estado da inscrição.
- **Solicitação via WhatsApp direto (sem registro no sistema)**: descartado — requisito pede tela de acompanhamento e histórico.

## Riscos e mitigação

- Rota pública sujeita a spam → validação por CPF + unicidade de solicitação aberta + motivo curto obrigatório.
- Estado inconsistente (estornado no app InfinitePay mas não registrado, ou vice-versa) → o registro exige confirmação explícita do admin e fica auditável (`resolvedById`); a auditoria do req. 6 (CSV do painel) é a rede de segurança que detecta divergência.
- Dados pessoais: motivo/telefone só em rotas admin; a rota pública responde apenas sucesso/erro.
- R-03: inscrição legada sem `Order` → valor sugerido do estorno vem de `resolveBaseValue` (mesma fonte do financeiro atual).

## Perguntas abertas

- **Q7**: cancelamento feito diretamente pelo admin (sem solicitação do participante) deve gerar uma `RefundRequest` de origem administrativa para fins de histórico (recomendado: sim, com flag/`adminNotes`), ou basta o status da inscrição?
- **Q8**: "Solicitações de estorno" como página própria no menu admin (recomendado; vira aba do novo painel no req. 8) ou aba dentro do financeiro?
- **Q9**: SUPPORT pode ver/operar a tela de solicitações **sem** os valores (ele já cadastra/edita inscrições), ou tela exclusiva de ADMIN+? (Recomendação: ADMIN+ na v1 — estorno é dinheiro.)

## Plano de implementação

1. Schema: `RefundRequest` + enums → `db push` local.
2. Backend público: `POST`/`DELETE refund-request` (Zod, CPF match, idempotência) + `publicRoutes`.
3. Backend admin: `GET`/`PATCH /api/admin/refund-requests` (controller + repository, guards por role) + `adminRoutes`/matcher.
4. Transições de estado + transação "registrar estorno + cancelar inscrição".
5. Frontend participante: botão + modal de motivo no `RegistrationProofModal`; estado "solicitação enviada"; ação de desistir.
6. Frontend admin: página/aba de solicitações (tabela AntD, filtros, ações, link WhatsApp com mensagem pronta).
7. Ações rápidas de cancelar/reativar na tela de inscrições (integra com req. 9).
8. Verificação (`tsc`/lint/build) + matriz abaixo; atualizar documentação (fluxo, permissões, este arquivo).

## Critérios de aceite / testes manuais

- Participante solicita cancelamento pelo comprovante (mobile) → sucesso; segunda tentativa → mensagem de já existente; desistir → solicitação encerrada.
- CPF errado na rota pública → 403/404 sem vazar existência de dados.
- Admin: contato via WhatsApp abre com mensagem correta; negar; registrar estorno (valor + confirmação) cancela a inscrição atomicamente.
- Reativação: cancelada não estornada → volta a `CONFIRMED`; cancelada estornada → "continuar pagamento" gera novo checkout sem duplicar inscrição (CPF).
- CHECKIN/SUPPORT → sem acesso à tela/rotas de estorno (403), conforme Q9.
- Financeiro reflete estornos registrados.
- Webhook: pagamento de reativação confirma normalmente (idempotência preservada).

## Checklist

- [x] P-04: pesquisa endpoint de estorno InfinitePay → **não existe API; fluxo manual assistido**
- [x] Análise técnica completa (máquina de estados de 3 níveis)
- [x] Q7/Q8/Q9 respondidas (ADR-003): Q7 sim (origem administrativa), Q8 página própria, Q9 ADMIN+
- [x] Schema (`RefundRequest`) + `db push`
- [x] Backend (rotas públicas e admin, permissões, transações)
- [x] Frontend (comprovante, tela de solicitações, WhatsApp)
- [x] Reativação por CPF sem duplicidade
- [x] Testes no servidor local (API); E2E em viewport mobile fica para o teste final
- [x] Documentação atualizada
- [ ] Aprovação do Ricardo

## Progresso / Arquivos alterados / Testes realizados / Pendências

**Implementado (2026-11-11).**

**Arquivos**
- `prisma/schema.prisma`: `RefundRequest` + enums `RefundOrigin`, `RefundRequestStatus`, `RefundResolution`; relação `Registration.refundRequests`.
- `backend/schemas/refundSchemas.ts`, `backend/services/refundService.ts`, `backend/controllers/RefundRequestController.ts`.
- Rotas: `app/api/registrations/[id]/refund-request` (POST/DELETE, públicas), `app/api/admin/refund-requests` (GET) e `[id]` (PATCH).
- `app/api/registrations/[id]/route.ts` (PUT): cancelar/reativar só ADMIN+, histórico administrativo, checagem de vaga na reativação.
- `search-by-cpf` e `get-by-id`: devolvem `refundRequest` (status/resolução, sem motivo nem notas).
- `middleware.ts` (rota pública do participante), `lib/permissions.ts` (matriz).
- UI: `components/RegistrationProofModal.tsx` (solicitar/desistir), `components/registration/GroupProofModal.tsx` (repasse do estado), `app/admin/refund-requests/page.tsx`, atalho "Estornos" em `app/admin/page.tsx`.

**Decisões**
- Máquina de estados do RFC mantida (`OPEN → IN_CONTACT → RESOLVED`); sem novo valor em `RegistrationStatus`.
- **Pedido em grupo: estorno por participante**, não pelo pedido inteiro. O valor sugerido/limite é o da própria inscrição (`resolveBaseValue`, lote e camisa), o `Order` não muda de status nem de total e recebe só uma entrada em `paymentDetails.history[]` (`refund_registered`, `registration_cancelled`, `registration_reactivated`). Cada pessoa tem comprovante e CPF próprios; o pedido segue válido para as demais.
- Inscrição legada (sem `Order`) usa a mesma lógica; nada específico.
- Q7: cancelamento direto (PUT com `CANCELLED` sobre inscrição `CONFIRMED`) cria `RefundRequest` com `origin = ADMIN`: `OPEN` quando pode haver dinheiro a devolver, já `RESOLVED/CANCELLED_NO_REFUND` quando a inscrição é gratuita. Não duplica se já houver solicitação em andamento.
- Q9: rotas `/api/admin/refund-requests*` e página `/admin/refund-requests` só ADMIN/SUPER_ADMIN (matriz + guarda no controller). Além disso, mudar uma inscrição para ou a partir de `CANCELLED` pelo PUT passou a exigir ADMIN+ (SUPPORT continua editando os demais campos).
- P-05: a listagem devolve `phoneE164` (`toBrazilE164`) e a tela monta o link `wa.me` com mensagem pronta.
- Participante: só inscrição `CONFIRMED` pode pedir; resposta pública idêntica (404) para "não existe" e "CPF não confere"; texto sem promessa de devolução ("depende do meio de pagamento"); desistir só enquanto a inscrição ainda está ativa.
- Reativação: pela tela de solicitações (ação `reactivate`) ou pelo PUT; exige vaga (evento e quota do lote, sob lock do evento). Solicitação com resolução `REFUNDED` não reativa: o participante paga de novo pelo CPF (fluxo existente de `create-preference`).

**Desvios do RFC**
- Campos extras: `RefundRequest.origin` (Q7), `resolvedAt`, e resolução `CANCELLED_NO_REFUND` (cancelar sem estorno: inscrição gratuita, dinheiro/manual ou acordo sem devolução). O RFC só previa `REFUNDED | DENIED | WITHDRAWN`.
- Ação "Reabrir" cobre apenas pedidos negados/desistidos com a inscrição ativa.
- `adminRoutes` e `config.matcher` do middleware já cobriam `/admin` e `/api/admin`; só a matriz de permissões e a rota pública do participante foram alteradas.
- Item 7 do plano (ações rápidas na tela de inscrições, req. 9): o cancelamento pelo `RegistrationModal` existente já dispara o histórico (Q7); botão dedicado fica para o req. 9.

**Testes (servidor local, banco local, dados apagados ao fim)**
- Participante: CPF errado/id inexistente 404 idêntico; motivo curto 422; criar 201; duplicada 409; desistir 200; desistir sem pedido 404; `search-by-cpf` devolve o estado do pedido.
- Admin: marcar contato; estorno sem confirmação 422; valor acima do pago 422; estorno registrado cancela a inscrição, grava `resolvedById`/valor e histórico do pedido; repetir 409; reativar estornada 409; negar, reabrir, cancelar sem estorno, reativar (inscrição legada).
- Pedido em grupo: estorno de uma pessoa deixa a outra `CONFIRMED`; cancelamento direto da segunda gera solicitação administrativa e entrada no histórico do pedido.
- Vaga: ocupadas 2 → 1 após cancelar; reativar com evento lotado 409; com vaga 200 e solicitação encerrada como desistência.
- Permissões: CHECKIN e SUPPORT 403 em GET/PATCH das rotas de estorno e redirecionados na página; anônimo 401; SUPPORT 403 ao cancelar/reativar pelo PUT, 200 ao editar nome; CHECKIN 403 no PUT.
- Inscrição gratuita cancelada pelo admin nasce `RESOLVED/CANCELLED_NO_REFUND`.
- `tsc`, `lint` (sem avisos novos) e `build` limpos.

**Pendências**
- Teste visual/E2E em viewport mobile e no navegador do Instagram (modal de pedido e tela de estorno) no teste final.
- Financeiro (req. 10) e auditoria (req. 6) devem ler `RefundRequest` com `resolution = REFUNDED` como saída/estorno.
- Sem rate limiting na rota pública (débito conhecido); proteção é CPF + uma solicitação aberta por inscrição.
- `db push` no Supabase no deploy (tabela e enums novos, aditivo).
