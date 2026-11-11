---
description: Ler a documentação normativa de docs/contexto-ia antes de implementar uma tarefa
argument-hint: [descrição da tarefa]
---

Prepare-se para implementar uma tarefa neste repositório lendo a documentação normativa de `docs/contexto-ia/` (fonte oficial de verdade).

Tarefa a preparar: $ARGUMENTS

## Passos

1. **Leitura obrigatória (sempre):**
   - `docs/contexto-ia/00_PROJECT_CONTEXT.md` — propósito, domínio, fluxos, regras de negócio
   - `docs/contexto-ia/08_AI_RULES.md` — constituição para IAs: conduta, qualidade, proibições
   - `docs/contexto-ia/07_FEATURE_GUIDE.md` — fluxo obrigatório de implementação de features

2. **Leitura condicional, conforme a área afetada pela tarefa:**
   - Qualquer mudança de código → `01_ARQUITETURA.md`
   - Mudanças em `/app/api` ou `/backend` → `02_BACKEND_GUIDELINES.md`
   - Mudanças em `/app` (páginas) ou `/components` → `03_FRONTEND_GUIDELINES.md`
   - Antes de criar qualquer componente → `04_COMPONENT_LIBRARY.md`
   - Qualquer mudança visual → `05_DESIGN_SYSTEM.md`
   - Tela nova ou refatorada → `06_UX_PRINCIPLES.md`
   - Planejamento/priorização → `09_DECISOES_E_DEBITOS.md`

   Se a tarefa não foi informada em $ARGUMENTS, pergunte ao usuário qual é a tarefa antes de decidir quais documentos condicionais ler.

3. **Ao final, apresente um resumo de preparação contendo:**
   - Quais documentos foram lidos e por quê
   - Regras e padrões normativos que se aplicam diretamente à tarefa (ex.: `withPrismaRetry`, envelope de resposta da API, camadas Controller → Repository, middleware de auth)
   - Débitos/decisões pendentes de `09_DECISOES_E_DEBITOS.md` que tocam a área da tarefa, se houver
   - Próximos passos sugeridos seguindo o fluxo do `07_FEATURE_GUIDE.md`

**Importante:** não implemente nada ainda — este comando é apenas de preparação. Aguarde a aprovação do usuário para iniciar a implementação.
