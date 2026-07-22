# 07 — Guia de Implementação de Features

Fluxo **obrigatório** para toda funcionalidade nova ou refatoração relevante,
por humano ou IA.

```
Entender o domínio
      ↓
Ler o contexto (00_PROJECT_CONTEXT)
      ↓
Consultar documentação da área (01–06 + /doc pertinente)
      ↓
Verificar componentes/hooks/utils existentes (04)
      ↓
Validar Design System e princípios de UX (05, 06)
      ↓
Definir arquitetura (camadas, rotas, schema)
      ↓
Implementar
      ↓
Testar (matriz de cenários + verificação técnica)
      ↓
Atualizar documentação
      ↓
Autorrevisão multi-perspectiva
```

## Etapa a etapa

### 1. Entender o domínio
Reler `00_PROJECT_CONTEXT.md` §5 (fluxo e regras invioláveis). Identificar quem
usa a feature (público leigo? admin?) — isso muda tudo (UX, auth, robustez).

### 2–3. Contexto e documentação
Mapear os documentos da área afetada (tabela no `README.md` desta pasta) e a
documentação profunda em `/docs`. Em pagamento/inscrição, `docs/FLUXO_INSCRICAO.md`
é leitura obrigatória.

### 4. Verificar o que já existe
- Componente similar? → `04_COMPONENT_LIBRARY.md`.
- Hook similar? → `03_FRONTEND_GUIDELINES.md` §5.
- Util/serviço similar? → `backend/utils`, `backend/services`.
- **Nunca** criar variação paralela de algo existente; estender o original.

### 5. Design (se houver tela)
Mobile first; referências do `06_UX_PRINCIPLES.md` §4; estados obrigatórios
(loading/empty/erro/sucesso); tokens do `05_DESIGN_SYSTEM.md`.

### 6. Definir arquitetura
- Precisa de rota nova? → route fino + controller + repository (+ schema Zod).
- Rota protegida? → `adminRoutes` **e** `config.matcher` do `middleware.ts`.
  Pública? → `publicRoutes` com justificativa e mínimo de dados.
- Mudança de schema Prisma? → avaliar impacto em produção (`db push`, sem
  migrations) e em JSONs existentes (compatibilidade retroativa dos schemas Zod).
- Checklist de segurança: `02_BACKEND_GUIDELINES.md` §7.

### 7. Implementar
Seguindo as diretrizes 02/03. Invioláveis: `withPrismaRetry`, envelope de
resposta, validação dupla, valores recalculados no servidor, CPF/telefone só
dígitos.

### 8. Testar
Não há suite automatizada (débito registrado). Mínimo exigido:

- `npx tsc --noEmit` + `npm run lint` + `npm run build` sem erros.
- Teste manual do fluxo tocado **no viewport mobile** (e das combinações da
  matriz quando tocar inscrição: gratuito/pago × formMode × camisa ×
  continuar pagamento × CPF duplicado).
- Rotas: testar caso feliz, entrada inválida (422 com `errors[]`), não
  autenticado (401/403) e — em pagamento — reprocessamento de webhook
  (idempotência).

### 9. Atualizar documentação
Na **mesma entrega**: catálogo (novo componente/hook), design system (novo
padrão visual), contexto (nova regra de negócio), `09` (novo débito/decisão).
Documentação desatualizada é bug.

### 10. Autorrevisão
Antes de dar por concluído, revisar a mudança sob cinco perspectivas:

- **Product Manager**: isso reduz fricção ou adiciona? O problema certo foi
  resolvido?
- **UX Designer**: um leigo no celular completa sem ajuda? Estados todos
  cobertos?
- **Software Architect**: camadas respeitadas? Algo duplicado? Middleware
  cobre a rota?
- **Staff Engineer**: casos de borda (concorrência de vagas, webhook duplicado,
  double-click no submit, JSON legado sem o campo novo)?
- **QA**: como isso quebra? O que acontece offline/3G/iOS/Instagram?

Só encerrar quando as cinco perspectivas aprovarem.
