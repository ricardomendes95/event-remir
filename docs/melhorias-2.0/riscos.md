# Riscos transversais

Riscos que atravessam mais de uma melhoria. Riscos específicos ficam no arquivo da própria melhoria.

| ID | Risco | Impacto | Mitigação |
|---|---|---|---|
| R-01 | Projeto **não tem suite de testes** — toda mudança em fluxo de pagamento/inscrição é validada manualmente | Alto: regressão silenciosa em produção com dinheiro real | Estratégia em `testes.md`; testar fluxo de pagamento em ambiente de teste do InfinitePay antes de deploy; considerar introduzir testes automatizados nas partes financeiras |
| R-02 | Schema evolui via `prisma db push` (sem migrations versionadas) direto no Supabase | Alto: alteração destrutiva sem rollback | Sempre revisar o diff que o `db push` reporta; fazer backup/export antes de mudanças em `registrations`; campos novos sempre opcionais ou com default |
| R-03 | Dados históricos: `paymentMethod` default é `MERCADO_PAGO` e inscrições antigas dependem de `paymentDetails` JSON | Médio: relatórios/auditoria podem quebrar com dados legados | Todo código novo trata os formatos legados; nunca reescrever dados históricos sem aprovação |
| R-04 | Conciliação InfinitePay assume `order_nsu = registration.id` (1:1) | Alto: reqs. 2/5 quebram o webhook se implementados sem ADR-001 | Decidir ADR-001 antes do req. 2; manter compatibilidade com `order_nsu` legado no webhook |
| R-05 | Middleware Edge + roles: novas roles (Check-in, Suporte) exigem mudança coordenada em `middleware.ts`, `BaseController` e enum `AdminRole` | Médio: rota protegida com verificação inconsistente → falha de autorização | Centralizar mapa rota→roles; revisar `adminRoutes`/`config.matcher` a cada rota nova |
| R-06 | Serverless + Supabase: prepared statements perdidos (padrão `withPrismaRetry` obrigatório) | Médio: 500 intermitente em rotas novas | Toda operação Prisma nova usa `withPrismaRetry`; revisar em code review |
| R-07 | Ant Design + React 19 + App Router têm quirks (SSR, `use client`) e há histórico de problemas iOS/mobile (`docs/MELHORIAS_IOS_COMPATIBILITY.md`) | Médio: telas novas quebradas em mobile | Testar telas novas em viewport mobile; seguir padrões dos componentes existentes |
| R-08 | Trabalho distribuído em muitas sessões — risco de perda de contexto | Médio: retrabalho ou implementação divergente do planejado | Esta pasta é a memória: atualizar `progresso.md` ao fim de TODA sessão |
