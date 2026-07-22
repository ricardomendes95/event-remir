# Contexto IA — Event Remir

Esta pasta é a **fonte oficial de verdade** para qualquer implementação neste
repositório, feita por humanos ou por IA. Os documentos são **normativos**: eles
não apenas descrevem o projeto — definem como ele **deve** evoluir.

## Regra de ouro

> Antes de escrever qualquer código, leia `00_PROJECT_CONTEXT.md` e o(s)
> documento(s) da área afetada. Em conflito entre código existente e esta
> documentação, a documentação prevalece — e o código deve ser alinhado a ela
> (ou a documentação atualizada de forma deliberada, nunca silenciosamente).

## Documentos da suíte

| Documento | Conteúdo | Quando ler |
|---|---|---|
| [00_PROJECT_CONTEXT.md](00_PROJECT_CONTEXT.md) | Propósito, domínio, fluxos, regras de negócio, papéis | **Sempre, antes de tudo** |
| [01_ARQUITETURA.md](01_ARQUITETURA.md) | Camadas, autenticação, padrões obrigatórios | Qualquer mudança de código |
| [02_BACKEND_GUIDELINES.md](02_BACKEND_GUIDELINES.md) | Regras normativas de rotas, controllers, repositories, Prisma | Mudanças em `/app/api` ou `/backend` |
| [03_FRONTEND_GUIDELINES.md](03_FRONTEND_GUIDELINES.md) | Regras de páginas, componentes, hooks, formulários | Mudanças em `/app` (páginas) ou `/components` |
| [04_COMPONENT_LIBRARY.md](04_COMPONENT_LIBRARY.md) | Catálogo de componentes: responsabilidade, quando (não) usar | **Antes de criar qualquer componente** |
| [05_DESIGN_SYSTEM.md](05_DESIGN_SYSTEM.md) | Tokens, tipografia, estados, feedback, acessibilidade | Qualquer mudança visual |
| [06_UX_PRINCIPLES.md](06_UX_PRINCIPLES.md) | Mobile first, conversão, público-alvo, inspirações | Qualquer tela nova ou refatorada |
| [07_FEATURE_GUIDE.md](07_FEATURE_GUIDE.md) | Fluxo obrigatório de implementação de features | Toda feature nova |
| [08_AI_RULES.md](08_AI_RULES.md) | Constituição para IAs: conduta, qualidade, proibições | **Obrigatório para qualquer IA** |
| [09_DECISOES_E_DEBITOS.md](09_DECISOES_E_DEBITOS.md) | Decisões pendentes, débitos técnicos, oportunidades | Planejamento e priorização |

## Relação com a pasta `/docs`

A pasta `/docs` (singular) contém a documentação **histórica e de profundidade**:
especificações, planos de migração, soluções técnicas detalhadas. Ela continua
válida como material de consulta e é referenciada daqui. Esta pasta
(`/docs/contexto-ia`) **consolida e normatiza** — não duplica. Documentos de
`/docs` referenciados como essenciais:

- `docs/FLUXO_INSCRICAO.md` — fluxo de inscrição em detalhe (fonte primária)
- `docs/SOLUCAO_PREPARED_STATEMENTS.md` + `docs/EXEMPLO_PRISMA_RETRY.md` — padrão Prisma
- `docs/PLANO_MIGRACAO_INFINITEPAY_E_CAMISA.md` — decisões do gateway ativo
- `docs/MELHORIAS_IOS_COMPATIBILITY.md` + `docs/PLANO_ACAO_MOBILE_FIXES.md` — quirks mobile

## Manutenção desta suíte

- Toda feature que altera fluxo, regra de negócio, componente reutilizável ou
  padrão visual **deve atualizar o documento correspondente na mesma entrega**.
- Melhorias de UX/UI validadas viram padrão: atualizar `05_DESIGN_SYSTEM.md`.
- Decisões tomadas saem de `09_DECISOES_E_DEBITOS.md` e entram no documento
  definitivo; débitos resolvidos são removidos.
