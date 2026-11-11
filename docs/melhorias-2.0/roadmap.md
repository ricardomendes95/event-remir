# Roadmap de implementação

Ordem definida no próprio `requisitos.md` (seção final): primeiro as fundações (permissões, cadastro, regras de negócio), por último as melhorias visuais e complementares.

## Ordem e status

| # | Req. | Melhoria | Status | Depende de |
|---|---|---|---|---|
| 1 | 11 | [Controle de permissões](./melhorias/11-controle-permissoes.md) | ✅ Concluída e aprovada (2026-07-24; deploy pendente — P-06) | — |
| 2 | 1 | [Cadastro e pagamentos](./melhorias/01-cadastro-pagamentos.md) | 🔍 RFC pronto | — |
| 3 | 3 | [Sistema de lotes](./melhorias/03-lotes-do-evento.md) | 🔍 RFC pronto | — |
| 4 | 2 | [Inscrição em lote](./melhorias/02-inscricao-em-lote.md) | 🔍 RFC pronto | ADR-001 aprovado |
| 5 | 12 | [Cancelamento e estorno](./melhorias/12-cancelamento-estorno.md) | 🔍 RFC pronto | Req. 11 ✅ |
| 6 | 6 | [Auditoria do InfinitePay](./melhorias/06-auditoria-infinitepay.md) | 🔍 RFC pronto | ADR-001; amostra de extrato (P-08) |
| 7 | 9 | [Tela de inscrições](./melhorias/09-tela-inscricoes.md) | 🔍 RFC pronto | Req. 1 (observação/método) |
| 8 | 10 | [Financeiro](./melhorias/10-financeiro.md) | 🔍 RFC pronto | Req. 1, 3; ideal após 6 e 12 |
| 9 | 5 | [Compra posterior da camisa](./melhorias/05-compra-posterior-camisa.md) | 🔍 RFC pronto | ADR-001 + req. 2 implementado |
| 10 | 4 | [Foto da camisa](./melhorias/04-foto-camisa.md) | 🔍 RFC pronto | — |
| 11 | 8 | [Novo painel administrativo](./melhorias/08-novo-painel-admin.md) | 🔍 RFC pronto | Req. 11 ✅ |
| 12 | 7 | [Página de lives](./melhorias/07-pagina-lives.md) | 🔍 RFC pronto (viabilidade ✅) | P-03 (canal/API key) |

> **2026-07-24**: todos os RFCs escritos (um por arquivo em `melhorias/`), com perguntas abertas Q1–Q15 consolidadas nos próprios RFCs. Implementação só começa após aprovação do Ricardo, seguindo esta ordem.

Legenda: 🔲 Não iniciada · 🔍 Em análise · 🚧 Em implementação · 🧪 Em testes · ✅ Concluída e aprovada · ⏸️ Bloqueada

## Dependência transversal importante — ADR-001

Os requisitos 2 (inscrição em lote), 5 (compra posterior da camisa), 6 (auditoria) e 12 (estorno) giram todos em torno da mesma lacuna: hoje **não existe entidade de pedido/transação** — o pagamento vive espalhado em `Registration.paymentId/paymentDetails` (JSON) e a conciliação assume `order_nsu = registration.id` (1 pagamento ↔ 1 inscrição).

Antes de implementar o requisito 2, decidir e registrar em `decisoes.md` (ADR-001) o modelo de dados de pedido/pagamento (ex.: model `Order`/`Payment` com N inscrições), pois essa decisão condiciona os quatro requisitos. Ver análise em cada arquivo de melhoria.

## Marcos sugeridos

- **Fase 1 — Fundações**: permissões (11), cadastro/pagamentos (1), lotes do evento (3).
- **Fase 2 — Núcleo financeiro**: ADR-001 → inscrição em lote (2), cancelamento/estorno (12), auditoria (6).
- **Fase 3 — Gestão**: tela de inscrições (9), financeiro/prestação de contas (10), compra posterior da camisa (5).
- **Fase 4 — Complementos**: foto da camisa (4), novo painel (8), página de lives (7).
