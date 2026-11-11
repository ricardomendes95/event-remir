# Requisito 10 — Financeiro como prestação de contas

- **Status**: 🔍 RFC pronto (aguardando aprovação)
- **Ordem no roadmap**: 8ª — depois dos reqs. 1 e 3; ideal após 6 e 12
- **Requisito original**: `../requisitos.md` (item 10)
- **RFC escrito em**: 2026-07-24

## Objetivo e escopo

Transformar `/admin/financial` em **prestação de contas por evento**, apresentável aos responsáveis: indicadores claros (inscritos, com/sem camisa, receita de inscrições × camisas × total, recebidos × pendências), **impressão do dashboard** e exportação atualizada.

**Fora de escopo**: gráficos novos sofisticados; conciliação (é o req. 6 — aqui apenas citamos o resultado dela quando existir); alterar cálculo de taxas (receita segue **bruta**, como hoje — taxas do InfinitePay ficam na conta do gateway).

## Estado atual do código (verificado em 2026-07-24)

- `app/admin/financial/page.tsx` (714 linhas): cards + tabela por evento + receita diária; filtro por período (default 1 mês) e evento; exportação **CSV** (não XLS de fato — o requisito chama de XLS; manter CSV, abre no Excel).
- `app/api/admin/financial/route.ts`: agrega por `paymentMethod` real (isInfinitePay × MANUAL), status e evento; receita por inscrição via valor do evento.
- Receita "com camisa" não é decomposta em lugar nenhum; `resolveBaseValue` dá o total por inscrição.
- Permissões: tela e rota já restritas (ADR-002 — CHECKIN/SUPPORT sem acesso a valores).
- Pré-requisitos que alimentam esta tela: req. 1 (espécie + responsável + observação), req. 3 (`batchId` → receita por lote), req. 12 (estornos), req. 6 (selo de conciliação), ADR-001 (camisa avulsa como receita própria).

## Decisões de produto/UX

- **Modo "prestação de contas" é por evento**: seletor de evento obrigatório para o relatório imprimível (a visão agregada multi-evento continua existindo na tela, mas o documento impresso é de um evento).
- Documento impresso com: cabeçalho (nome do evento, período, data de emissão, quem emitiu), blocos de indicadores, tabela por método (InfinitePay × Manual/PIX × Manual/Dinheiro — com responsáveis — × Manual/Cartão), lote a lote (req. 3), estornos (req. 12), e nota de critérios ("valores brutos; receita de camisa = diferença entre preço com e sem camisa do lote").
- Indicadores pedidos, todos calculados **no servidor**:
  - Total de inscritos (confirmados) · inscritos com camisa · sem camisa;
  - "X compraram inscrição + camisa / Y apenas inscrição" (texto pronto, como o requisito pede);
  - Receita de inscrições · receita de camisas · receita total;
  - Valores recebidos (CONFIRMED) · pendências (PENDING, com contagem e valor);
  - Quando req. 12 existir: estornos registrados (contagem e valor, subtraídos do líquido).

## Arquitetura proposta

### Regra de decomposição inscrição × camisa (D4)

- Por inscrição confirmada: `valorCamisa = (priceWithShirt − price)` do **lote registrado** (`batchId`, req. 3) ou do evento (sem lote); `valorInscricao = resolveBaseValue(...) − valorCamisa` quando `wantsShirt`, senão `resolveBaseValue`.
- Camisa avulsa (req. 5/ADR-001): soma-se à receita de camisas pelo `Order.totalValue` do pedido `SHIRT_ONLY`.
- **Dados históricos**: decompostos com a config **atual** do evento — se preços mudaram no meio do caminho, o número é aproximado; a limitação é declarada na nota de critérios do documento (números que não fecham silenciosamente minam a confiança; declarados, não).

### Backend

- Estender `app/api/admin/financial/route.ts` (ou rota irmã `.../financial/summary`) com os agregados novos: por camisa, por sub-método manual (req. 1: `manualPaymentType`, `cashResponsible`), por lote, estornos. Agregação no banco (`groupBy`/`count` Prisma com `withPrismaRetry`), nunca no client.
- Reutilizar `resolveBaseValue`/`getShirtConfig`; extrair a decomposição (D4) para `backend/utils/revenueBreakdown.ts` — função pura compartilhada com stats/exportação (fonte única de números).

### Frontend

- `app/admin/financial/page.tsx`: bloco "Prestação de contas do evento" (cards + tabelas), botão **Imprimir** (CSS `@media print`: oculta navegação/filtros, cabeçalho próprio, quebras de página por seção).
- Exportação CSV: colunas novas (camisa, sub-método, responsável do dinheiro, lote, estornos).

## Alternativas consideradas

- PDF gerado no servidor: descartado — `@media print` atende, sem dependência nova (regra 9).
- Guardar o valor pago decomposto na inscrição no momento do pagamento (snapshot): resolveria o histórico com precisão, mas só vale para dados futuros; **adotado parcialmente** — pedidos novos (ADR-001) já guardam `amountCents` pagos; para o resto vale a D4.
- Planilha XLSX real (lib `exceljs`): adiado — CSV abre no Excel; dependência nova exigiria decisão registrada.

## Riscos e mitigação

- Números divergentes entre tela, stats e exportação → fonte única (`revenueBreakdown`), usada pelos três.
- Performance com muitos registros → agregação no banco; período default limitado; índices existentes suficientes (volume da igreja é moderado).
- Histórico aproximado (preço alterado após inscrições) → nota de critérios impressa (decisão consciente, D4).

## Perguntas abertas

- **Q13** (compartilhada com o req. 5): confirmar que a receita da camisa é sempre a **diferença** `priceWithShirt − price` (nunca um preço próprio de camisa desvinculado).

## Plano de implementação

1. `backend/utils/revenueBreakdown.ts` (D4) — função pura + uso nas rotas de stats/financeiro.
2. Agregados novos na rota do financeiro (camisa, sub-método, lote, estornos, textos prontos).
3. Bloco "Prestação de contas" na página + cards/indicadores.
4. CSS de impressão + cabeçalho do documento.
5. Exportação CSV com colunas novas.
6. Verificação (`tsc`/lint/build) + conferência manual dos números contra uma amostra real; atualizar documentação.

## Critérios de aceite / testes manuais

- Selecionar evento → indicadores batem com contagens manuais da tela de inscrições (mesmo banco de teste).
- Evento com camisa → "X inscrição+camisa / Y apenas inscrição" corretos; receita camisas = X × diferença (por lote).
- Espécie: total em dinheiro + lista de responsáveis (req. 1) visíveis.
- Pendências: contagem e valor de PENDING corretos.
- Impressão: documento limpo em A4 retrato, sem navegação, com critérios; legível também em preto e branco.
- CSV reabre no Excel com as colunas novas.
- Dados históricos (sem lote/sub-método) → agrupados como "não informado", nada quebra.
- CHECKIN/SUPPORT → sem acesso (regressão do req. 11).

## Checklist

- [x] Análise técnica completa (2026-07-24)
- [x] Regra de decomposição inscrição × camisa definida (D4, com limitação declarada p/ históricos)
- [ ] Q13 confirmada
- [ ] Endpoints agregadores (fonte única `revenueBreakdown`)
- [ ] Dashboard com indicadores + textos prontos
- [ ] Impressão (`@media print`)
- [ ] CSV atualizado
- [ ] Testes (ver `../testes.md`)
- [ ] Documentação atualizada
- [ ] Aprovação do Ricardo

## Progresso / Arquivos alterados / Testes realizados / Pendências

_(preencher durante a implementação)_
