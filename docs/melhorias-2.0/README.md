# Melhorias 2.0 — Documentação de planejamento e execução

Esta pasta é a **fonte de verdade e memória de longo prazo** para a implementação das melhorias da versão 2.0 do Event Remir. Toda sessão de trabalho deve começar pela leitura desta documentação e terminar com sua atualização.

> O prompt original com os requisitos está em [`requisitos.md`](./requisitos.md) — **não modificar**. (O prompt menciona `melhorias.md`, mas o arquivo foi salvo como `requisitos.md`.)

## Como usar esta pasta (para futuras sessões)

1. Ler [`progresso.md`](./progresso.md) para saber o estado atual e o que foi feito na última sessão.
2. Ler [`roadmap.md`](./roadmap.md) para saber qual é a próxima melhoria.
3. Abrir o arquivo da melhoria em [`melhorias/`](./melhorias/) e seguir o plano/checklist dela.
4. Consultar [`decisoes.md`](./decisoes.md) antes de tomar decisões arquiteturais — pode já existir decisão registrada.
5. Ao concluir qualquer trabalho: atualizar o arquivo da melhoria, `progresso.md` e, se houve decisão nova, `decisoes.md`.
6. **Nunca iniciar a próxima melhoria sem aprovação explícita do Ricardo.**

## Índice

| Arquivo | Conteúdo |
|---|---|
| [`requisitos.md`](./requisitos.md) | Prompt original com os 12 requisitos (imutável) |
| [`roadmap.md`](./roadmap.md) | Ordem de implementação, dependências e status resumido |
| [`progresso.md`](./progresso.md) | Diário de execução por sessão (o que foi feito, onde parou) |
| [`decisoes.md`](./decisoes.md) | ADRs simplificados — decisões arquiteturais e seus motivos |
| [`riscos.md`](./riscos.md) | Riscos transversais identificados |
| [`pendencias.md`](./pendencias.md) | Itens pendentes que não pertencem a uma melhoria específica |
| [`testes.md`](./testes.md) | Estratégia de testes (o projeto não tem suite configurada) |
| [`melhorias/`](./melhorias/) | Um arquivo por melhoria, numerado conforme o requisito original |

## Arquivos das melhorias

A numeração dos arquivos segue o **número do requisito** em `requisitos.md` (referência estável). A **ordem de implementação** é outra e está em `roadmap.md`.

| Requisito | Arquivo | Título |
|---|---|---|
| 1 | [`melhorias/01-cadastro-pagamentos.md`](./melhorias/01-cadastro-pagamentos.md) | Cadastro de participantes e pagamentos (observação, método manual) |
| 2 | [`melhorias/02-inscricao-em-lote.md`](./melhorias/02-inscricao-em-lote.md) | Inscrição em lote (várias inscrições, um pagamento) |
| 3 | [`melhorias/03-lotes-do-evento.md`](./melhorias/03-lotes-do-evento.md) | Sistema de lotes do evento (1º/2º/3º lote com preço próprio) |
| 4 | [`melhorias/04-foto-camisa.md`](./melhorias/04-foto-camisa.md) | Upload de foto da camisa |
| 5 | [`melhorias/05-compra-posterior-camisa.md`](./melhorias/05-compra-posterior-camisa.md) | Compra posterior da camisa por inscrito confirmado |
| 6 | [`melhorias/06-auditoria-infinitepay.md`](./melhorias/06-auditoria-infinitepay.md) | Auditoria financeira do InfinitePay (CSV/OFX, conciliação) |
| 7 | [`melhorias/07-pagina-lives.md`](./melhorias/07-pagina-lives.md) | Página de transmissões ao vivo (YouTube) |
| 8 | [`melhorias/08-novo-painel-admin.md`](./melhorias/08-novo-painel-admin.md) | Novo painel administrativo (layout exclusivo) |
| 9 | [`melhorias/09-tela-inscricoes.md`](./melhorias/09-tela-inscricoes.md) | Melhorias na tela de inscrições |
| 10 | [`melhorias/10-financeiro.md`](./melhorias/10-financeiro.md) | Financeiro como prestação de contas |
| 11 | [`melhorias/11-controle-permissoes.md`](./melhorias/11-controle-permissoes.md) | Controle de permissões (Admin, Check-in, Suporte) |
| 12 | [`melhorias/12-cancelamento-estorno.md`](./melhorias/12-cancelamento-estorno.md) | Cancelamento e estorno |

## Fluxo obrigatório por melhoria

1. Atualizar a documentação desta pasta.
2. Fazer a análise técnica completa (registrar no arquivo da melhoria).
3. Identificar impactos (banco, backend, frontend, APIs/integrações) e riscos.
4. Elaborar plano de implementação com checklist.
5. Implementar **apenas uma** melhoria.
6. Executar testes (`npm run lint`, `npm run build` + testes manuais descritos em `testes.md`).
7. Atualizar a documentação com tudo o que foi realizado (arquivos alterados, testes, pendências).
8. Marcar o progresso em `progresso.md` e `roadmap.md`.
9. **Aguardar aprovação do Ricardo antes da próxima.**

## Regras do projeto que se aplicam a todas as melhorias

- `/docs/contexto-ia` é a documentação normativa do repositório — seguir `08_AI_RULES.md` e o fluxo de `07_FEATURE_GUIDE.md`.
- Arquitetura Controller → Repository → Prisma (`/backend`); rotas em `/app/api` são finas.
- Toda operação Prisma em rota de API usa `withPrismaRetry` (`lib/prisma.ts`).
- Autenticação via middleware global (`middleware.ts`) que injeta headers `x-user-*`; novas rotas protegidas entram em `adminRoutes` E no `config.matcher`.
- Envelope de resposta: `{ success, data, message? }` / `{ success: false, error, errors? }`.
- Valores de pagamento sempre recalculados no servidor; conciliação InfinitePay por `order_nsu`.
- Schema via `npm run db:push` (projeto não usa migrations versionadas).
