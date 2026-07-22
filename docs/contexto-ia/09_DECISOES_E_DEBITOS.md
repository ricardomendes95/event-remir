# 09 — Decisões Pendentes, Débitos Técnicos e Oportunidades

Documento vivo. Decisões tomadas migram para o documento definitivo; débitos
resolvidos são removidos. Datas em formato absoluto.

## 1. Débitos críticos resolvidos

### D-01 — ✅ RESOLVIDO (2026-07-22) — `/api/debug/registrations` estava pública
A rota retornava as 10 inscrições mais recentes com **CPF, e-mail, paymentId e
paymentDetails**, e o `config.matcher` do `middleware.ts` não cobria o prefixo
`/api/debug` — logo estava acessível sem autenticação em produção. **Rota
removida em 2026-07-22.** A causa raiz (modelo de segurança por opt-in do
matcher) permanece registrada como D-11.

### D-03 — ✅ RESOLVIDO (2026-07-22) — Legado Mercado Pago removido
Decisão P-01: removidos `lib/mercadopago.ts`, `MercadoPagoCheckout`,
`PaymentMethodSelector`, `PaymentConfigForm`, `paymentFeeCalculator`, o webhook
MP, `update-preference` (sem chamadores), `payment-methods`, a página
`/admin/settings` (seletor de gateway), `getActiveGateway` e as dependências
npm `mercadopago`/`@types/mercadopago`. `create-preference` e `status` agora
são InfinitePay-only; `stats` calcula receita bruta via `resolveBaseValue`.
Restos deliberados: ver D-13.

## 2. Débitos técnicos

| ID | Débito | Impacto | Direção recomendada |
|---|---|---|---|
| D-02 | **Sem testes automatizados** (nenhum runner configurado) | Regressões silenciosas no fluxo de pagamento/inscrição | Adotar Vitest para `backend/utils` e schemas (puros, fáceis); Playwright depois para o fluxo de inscrição |
| D-04 | **`bcrypt` e `bcryptjs` instalados juntos** (utils usam um, seed/legado outro) | Confusão e peso de dependência | Unificar em `bcryptjs` (sem binário nativo, melhor p/ serverless) |
| D-05 | **`react-hook-form` + `@hookform/resolvers` nas deps** mas padrão real é AntD Form | Ambiguidade de padrão | Decidir: remover as deps ou migrar formalmente — até lá, AntD Form é o padrão |
| D-06 | **Cores hardcoded** em `ui/Button` e seções da home (`#015C91` etc.) | Inconsistência visual, refactor caro | Migrar para tokens de `globals.css` ao tocar cada componente |
| D-07 | **`app/home/page.tsx` duplica `app/page.tsx`** (mesmas seções, rota `/home` redundante) | Manutenção dupla, SEO difuso | Remover `/home` ou redirecionar para `/` |
| D-08 | **CORS aberto** (`vercel.json` com headers permissivos globais) | Superfície desnecessária | Restringir aos domínios reais quando houver janela |
| D-09 | **`PageView` coleta geolocalização** sem política de privacidade visível | Risco LGPD | Decisão P-05 (2026-07-22): **manter a coleta e documentar** — criar página de política de privacidade no site (tarefa pendente) |
| D-10 | **Sem histórico de migrations** (`prisma db push` direto na produção) | Mudanças de schema arriscadas | Considerar `prisma migrate` quando o schema estabilizar |
| D-11 | **Matcher do middleware por lista de prefixos** — segurança por opt-in | Toda rota nova fora da lista nasce pública (causa do D-01) | Avaliar inverter o modelo (matcher amplo + allowlist pública explícita) |
| D-12 | **Sem Prettier** — formatação por convenção implícita | Diffs ruidosos | Adicionar Prettier com config padrão (decisão barata) |
| D-13 | **Vestígios do Mercado Pago no schema** (`AppSettings` sem função, `Event.paymentConfig`, `PaymentConfigSchema`+tipos, valores `MERCADO_PAGO` nos enums) | Clutter no schema; enums não podem perder o valor enquanto houver registros históricos | Mantidos de propósito para evitar mudança destrutiva no banco (`db push`). Limpar junto com uma futura migração planejada (D-10) |

## 3. Decisões do mantenedor (respondidas em 2026-07-22)

| ID | Pergunta | Decisão |
|---|---|---|
| P-01 | Remover de vez o legado Mercado Pago? | **Remover agora** — executado (ver D-03) |
| P-02 | `INFINITEPAY_HANDLE` está configurada em produção? | **Sim, configurada** — pendência encerrada |
| P-03 | E-mails/WhatsApp de confirmação de inscrição? | **Nada por ora** — comprovante em tela + busca por CPF permanecem o padrão; reavaliar com demanda real |
| P-04 | Inscrição em lote (família/grupo) entra no roadmap? | **Sim — é a PRÓXIMA FEATURE prioritária.** Partir de `docs/RFC_INSCRICAO_EM_LOTE.md` e `docs/ANALISE_DE_VIABILIDADE_DA_FEATURE_DE_INSCRICAO_EM_LOTE.md` |
| P-05 | Retenção/privacidade de `PageView` (geo) | **Manter a coleta e documentar** — criar política de privacidade visível no site (registrado em D-09) |

## 4. Oportunidades de evolução

### Arquitetura
- Testes nos pontos de maior risco: `shirtPricing`, `dynamicFormValidator`,
  webhook InfinitePay (idempotência), dedup por CPF.
- Verificação de vagas com controle de concorrência (hoje contagem + insert sem
  lock — risco de overbooking em evento concorrido).
- Rate limiting nas rotas públicas de busca por CPF (enumeração).

### UX / Conversão
- Medir funil real do modal de inscrição (etapa a etapa) com o analytics
  próprio — hoje só há page views.
- Autopreenchimento por CPF recorrente entre eventos ("já te conhecemos —
  confirmar dados?") respeitando privacidade.
- Página de status pós-pagamento com atualização automática (hoje depende de o
  usuário voltar/buscar comprovante se o redirect do gateway falhar).

### UI
- Consolidar identidade: hoje convivem AntD (admin/fluxos) e Tailwind custom
  (institucional). Aceitável, mas as fronteiras devem seguir `05` §2 — admin
  100% AntD, institucional 100% tokens.
- Dark mode: **fora de escopo** — não implementar sem decisão de produto.
