# Pendências gerais

Itens pendentes que não pertencem ao escopo de uma única melhoria. Pendências específicas ficam no arquivo da melhoria correspondente.

| # | Pendência | Origem | Status |
|---|---|---|---|
| P-01 | Aprovar estrutura de documentação e roadmap | Sessão 1 (2026-07-22) | ✅ Aprovada (2026-07-24, junto com o req. 11) |
| P-02 | Decidir ADR-001 (modelo de pedido/pagamento) antes do requisito 2 | `decisoes.md` | ⏳ Pendente de análise |
| P-03 | Confirmar com o Ricardo qual é o canal oficial do YouTube da igreja (req. 7) e se há acesso a uma API key do Google | Req. 7 | ⏳ Aguardando informação |
| P-04 | Verificar na documentação oficial do InfinitePay: existência de endpoint de estorno (req. 12) e de API de listagem de transações (req. 6) | Reqs. 6 e 12 | ✅ Pesquisado (2026-07-24): a API pública de checkout ([infinitepay.io/checkout-documentacao](https://www.infinitepay.io/checkout-documentacao)) expõe **apenas** `POST /links`, `POST /payment_check` e o webhook de aprovação. **Não há API de estorno nem de listagem de transações** — estorno é manual pelo app (exige saldo; Pix em até 90 dias, total ou parcial) e extratos saem do painel como CSV/OFX. Consequências registradas nos RFCs 6 e 12 |
| P-05 | Definir se a numeração/telefone de WhatsApp para o botão "Entrar em contato" (req. 12) usa o telefone do participante em E.164 (padrão já usado no checkout) | Req. 12 | ⏳ Pendente |
| P-06 | **Bloqueante para deploy do req. 11**: aplicar enum `CHECKIN`/`SUPPORT` no Supabase (`prisma db push` com URLs de produção) — hoje só existe no Postgres local | Req. 11 | ⏳ Pendente |
| P-07 | Atenção operacional: `.env.local` (prioridade no Next) aponta para o Supabase; `.env` (usado pelo Prisma CLI) para o banco local — dev local conversa com produção sem parecer | Sessão 2 | ⚠️ Registrado |
| P-08 | Obter com o Ricardo uma **amostra real do extrato CSV** (e um OFX para arquivo) exportado do painel InfinitePay — bloqueia o mapa de colunas do parser do req. 6 (Q10) | RFC-06 (2026-07-24) | ⏳ Aguardando Ricardo |
