# Requisito 2 — Inscrição em lote (várias inscrições, um pagamento)

- **Status**: 🔍 RFC pronto (aguardando aprovação) — **depende do ADR-001 aprovado**
- **Ordem no roadmap**: 4ª
- **Requisito original**: `../requisitos.md` (item 2)
- **RFC escrito em**: 2026-07-24

## Objetivo

Cadastrar vários participantes em um único processo, gerar **um só pagamento** e vincular todas as inscrições ao mesmo pedido.

## RFC de referência (não duplicar)

Este requisito **já possui RFC completo e revisado**: **`docs/RFC_INSCRICAO_EM_LOTE.md` (rev. 2)** + `docs/ANALISE_DE_VIABILIDADE_DA_FEATURE_DE_INSCRICAO_EM_LOTE.md` — adotados como especificação oficial desta melhoria (decisão P-04 do contexto-ia). Este arquivo é o **wrapper de execução**: registra o que o RFC decide, o que mudou desde que ele foi escrito, e o plano/checklist de entrega.

### Decisões do RFC que valem como especificação

- Modelo **`Order` 1:N `Registration`** (alternativa B; agora formalizado e estendido no **ADR-001** em `../decisoes.md` — o schema definitivo é o do ADR, que soma `type`, colunas tipadas de auditoria e `targetRegistrationId` ao model do RFC).
- `order_nsu` prefixado: `"ord_" + order.id`; roteamento no webhook por prefixo; caminho individual bit a bit intocado.
- UX **sem wizard**: checkbox "Inscrever mais pessoas nesta mesma compra" + quantidade + cards accordion no mesmo `EventRegistrationModal` (2 steps de hoje); termo oficial **"Responsável pela compra"**; `MAX_BATCH_SIZE = 10`.
- Endpoints novos: `create-batch-preference`, `create-free-batch`, `leave-order`, "continuar pagamento" de pedido; webhook estendido com salvaguarda de link obsoleto (seção 9.7 do RFC).
- Pedido pendente abandonado: **Opção C** (participante escolhe entre continuar o pagamento do grupo ou sair e se inscrever sozinho), com a Opção D (resolução manual pelo admin) como redução de escopo aceitável da 1ª entrega.
- `$transaction` com lock na checagem de vagas — pré-requisito, primeiro uso do padrão no projeto.
- Plano em 9 fases (0–8) com critérios de aceite por fase — seção "Plano de Implementação" do RFC.

## Atualizações desde a escrita do RFC (2026-07-24)

1. **ADR-001 estende o model `Order`** (tipo do pedido, colunas de auditoria, camisa avulsa) — implementar o schema do ADR já na Fase 0, para não alterar a tabela duas vezes.
2. **Interação com o req. 3 (lotes do evento)**, que não existia quando o RFC foi escrito e será implementado **antes** (3ª vs 4ª do roadmap):
   - O total do pedido soma `resolveBaseValue` **batch-aware** por participante (todos os participantes do lote-bulk usam o mesmo `EventBatch` vigente no momento da criação).
   - A reserva de vagas na `$transaction` precisa checar **as duas quotas**: `maxParticipants` global e `quota` do lote vigente (N vagas de uma vez).
   - A saída de participante (`leave-order`) recalcula o total usando o lote registrado nas inscrições remanescentes.
3. **Interação com o req. 1**: campo `notes` e afins não afetam o fluxo público — sem impacto.
4. **Permissões (req. 11, já entregue)**: os endpoints novos de lote são públicos (fluxo do participante) → entram em `publicRoutes` com justificativa; `leave-order` idem (mesma superfície da busca por CPF, conforme seção 14 do RFC).
5. **Questão em aberto do RFC ("InfinitePay permite invalidar link?")**: a pesquisa da P-04 (2026-07-24) confirmou que a API pública **não** oferece invalidação de link — seguir apenas com a salvaguarda da seção 9.7 (comparação de `transactionNsu`), como o RFC já previa para esse caso.

## Riscos (além dos do RFC)

- R-04: compatibilidade `order_nsu` legado obrigatória — coberta pelo prefixo.
- Sequenciamento: se o req. 3 atrasar, o lote-bulk pode ser entregue sem lotes de preço (fallback `event.price`) — o desenho não acopla os dois.

## Perguntas abertas

- **Q6**: a 1ª entrega inclui a Fase 6 do RFC (`leave-order` self-service) ou adotamos a Opção D (resolução manual pelo admin) e entregamos a Fase 6 na sequência? (Recomendação: incluir — o RFC mostra que a salvaguarda do webhook precisa existir de qualquer forma, e o custo incremental é conhecido.)

## Plano de implementação

Seguir as **Fases 0–8 do RFC** (`docs/RFC_INSCRICAO_EM_LOTE.md`, seção "Plano de Implementação"), com os ajustes acima:

- Fase 0 usa o schema do **ADR-001** (não o schema resumido do RFC).
- Fases 2/3 integram `resolveActiveBatch`/quota de lote (req. 3) na transação de vagas.
- Fase 4 (webhook) usa as colunas tipadas do ADR-001 ao persistir a confirmação.
- Fase 6 conforme Q6.
- Fase 8 (flag `Event.allowBatchRegistration`) mantida — rollout controlado.

## Critérios de aceite / testes

Matriz completa na seção 20 do RFC (unitários, integração, webhook, concorrência, E2E mobile). Somam-se: cenários com lote de preço vigente (total por lote, virada de lote durante preenchimento) e regressão do fluxo individual com e sem lote.

## Checklist

- [x] ADR-001 detalhado (proposta em `../decisoes.md`)
- [ ] ADR-001 **aprovado pelo Ricardo**
- [x] Análise técnica completa (RFC rev. 2 + este wrapper)
- [ ] Q6 respondida
- [ ] Schema (`Order` conforme ADR-001) + `db push`
- [ ] Backend (create-batch-preference, create-free-batch, webhook, continuar pagamento, leave-order)
- [ ] Frontend (extensão inline do modal, comprovante consolidado, alerta de grupo)
- [ ] Compatibilidade `order_nsu` legado verificada
- [ ] Testes (seção 20 do RFC + `../testes.md`)
- [ ] Documentação atualizada (`docs/FLUXO_INSCRICAO.md`, RFC marcado como implementado)
- [ ] Aprovação do Ricardo

## Progresso / Arquivos alterados / Testes realizados / Pendências

_(preencher durante a implementação)_
