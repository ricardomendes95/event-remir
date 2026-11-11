# Requisito 7 — Página de transmissões ao vivo

- **Status**: 🔍 RFC pronto (análise de viabilidade concluída; aguardando aprovação + P-03)
- **Ordem no roadmap**: 12ª (última)
- **Requisito original**: `../requisitos.md` (item 7)
- **RFC escrito em**: 2026-07-24

## Objetivo e escopo

Página pública que mostre automaticamente, a partir do canal oficial da igreja no YouTube: **live em andamento**, **próximas lives** (se a API permitir) e **lives encerradas**.

**Fora de escopo**: chat próprio, notificações, multi-canal, transmissão via outra plataforma.

## Análise de viabilidade (concluída em 2026-07-24)

Três abordagens, combináveis:

| Abordagem | Ao vivo | Próximas | Encerradas | Custo/limite |
|---|---|---|---|---|
| **YouTube Data API v3** — `search.list` com `channelId` + `eventType=live\|upcoming\|completed` | ✅ | ✅ | ✅ | 100 unidades/chamada; quota padrão 10.000/dia **e teto específico de ~100 `search.list`/dia** (política 2026) → exige cache no servidor; requer API key (P-03) |
| **Embed sem API**: `youtube.com/embed/live_stream?channel=CHANNEL_ID` | ✅ (player direto) | ❌ | ❌ | Zero custo/chave; se não há live, player mostra erro feio → precisa de tratamento |
| **RSS do canal**: `youtube.com/feeds/videos.xml?channel_id=…` | ⚠️ não distingue live | ❌ | ⚠️ vídeos recentes (sem marcar o que foi live) | Zero custo/chave |

**Veredito: viável.** Recomendação — **API v3 com cache agressivo no servidor** como solução completa (cobre os três estados pedidos), com **degradação automática** para o embed simples se a chave faltar/quotar:

- 3 chamadas `search.list` (live/upcoming/completed) por atualização de cache; cache de **10 min** → ~432 chamadas/dia no pior caso... **acima do teto de 100/dia** → cache de **30 min** para live (48/dia) e **6 h** para upcoming/completed (8/dia) = ~56 chamadas/dia, folga confortável. Live em andamento também pode ser detectada barato via embed na própria página.
- Otimização adicional (fase 2, se necessário): trocar `search.list` de completed por playlist de uploads + `videos.list` (1 unidade) filtrando `liveStreamingDetails`.

## Decisões de produto/UX

- Página pública `/lives`: player em destaque quando há live ("🔴 Ao vivo agora"); seção "Próximas transmissões" (data/hora + lembrete via link do YouTube); seção "Transmissões anteriores" (grade de miniaturas, últimas ~6, link/embed).
- **Estado vazio bem desenhado** (canal sem live é o caso comum): mensagem acolhedora + link para o canal + últimas encerradas.
- Link no menu do site institucional (header/footer) — página pública, fora do middleware de auth.

## Arquitetura proposta

- `app/api/lives/route.ts` (pública — adicionar a `publicRoutes`? **não é necessário**: fora dos prefixos protegidos do matcher; conferir regra dura 3 mesmo assim): consulta a YouTube API com `YOUTUBE_API_KEY` + `YOUTUBE_CHANNEL_ID` (env vars, nunca no client), cache em memória do servidor com TTLs acima + `Cache-Control`/`revalidate` do Next; resposta no envelope padrão com `{ live, upcoming, completed }`.
- Sem chave configurada → rota responde `{ live: null, upcoming: [], completed: [], fallback: "embed" }` e a página renderiza só o embed `live_stream?channel=` + link do canal (MVP sem API key).
- `app/lives/page.tsx`: página institucional (tokens Tailwind do site público, não AntD — fronteira do `05_DESIGN_SYSTEM.md` §2), mobile first, embeds com `loading="lazy"` e consentimento leve de terceiros? (YouTube embed padrão; sem cookies próprios).
- Sem banco: configuração via env vars (canal único e estável). Se um dia precisar trocar canal pelo admin, aí sim `AppSettings`.

## Alternativas consideradas

- Chamar a API do YouTube direto do client: descartado — exporia a chave e multiplicaria quota por visitante.
- Cache no banco (`PageView`-like): desnecessário — cache em memória + revalidate atende; sem requisito de histórico próprio.
- Scraping da página do canal: frágil e contra os termos — descartado.

## Riscos e mitigação

- Estouro do teto de `search.list` → TTLs dimensionados acima + degradação automática para embed.
- Cold start serverless zera cache em memória → aceitável (pior caso: 1 chamada por instância nova); `revalidate` do Next reduz.
- Canal errado/da chave → validação na configuração + P-03.
- Página vazia → estado vazio desenhado (decisão acima).

## Perguntas abertas

- **P-03 (pendência existente)**: qual é o canal oficial (channel ID) e existe conta Google da igreja para criar projeto/API key? Sem resposta, o MVP embed ainda é entregável (só live atual, sem listas).

## Plano de implementação

1. Confirmar P-03 (channel ID + chave) — define se a v1 é completa ou MVP embed.
2. `app/api/lives/route.ts` com cache/TTLs + fallback sem chave.
3. `app/lives/page.tsx` (player, próximas, anteriores, estado vazio) + link no menu institucional.
4. Env vars documentadas (`.env.example`, `docs/DEPLOY_GUIDE.md`).
5. Verificação (`tsc`/lint/build) + testes manuais (com live de teste não listada? usar canal público qualquer em dev); atualizar documentação.

## Critérios de aceite / testes manuais

- Com chave: live ativa aparece em destaque; próximas listadas com data; encerradas em grade; quota diária estimada ≤ 60 chamadas.
- Sem chave: página funciona em modo embed com estado vazio digno.
- Mobile/Instagram browser: player funciona; página leve (Lighthouse mobile razoável).
- Rota `/api/lives` não expõe a chave em nenhuma resposta/erro.

## Checklist

- [ ] P-03: channel ID e API key definidos com o Ricardo
- [x] Análise de viabilidade concluída → **viável; API v3 + cache com fallback embed**
- [ ] Backend (rota com cache)
- [ ] Frontend (página pública, mobile testado)
- [ ] Testes (ver `../testes.md`)
- [ ] Documentação atualizada
- [ ] Aprovação do Ricardo

## Progresso / Arquivos alterados / Testes realizados / Pendências

_(preencher durante a implementação)_
