# Requisito 5 — Compra posterior da camisa

- **Status**: ✅ Implementado em 2026-11-11 (aguardando aprovação final do Ricardo)
- **Ordem no roadmap**: 9ª
- **Requisito original**: `../requisitos.md` (item 5)
- **RFC escrito em**: 2026-07-24

## Objetivo e escopo

Inscrito **já confirmado** compra depois **apenas a camisa**: cadastro existente atualizado (sem duplicar inscrição), cobrança só da camisa, histórico financeiro mantido, comprovante atualizado.

**Fora de escopo**: troca de tamanho após compra (admin resolve editando a inscrição); compra de camisa por quem não é inscrito; mais de uma camisa por inscrição.

## Estado atual do código (verificado em 2026-07-24)

- `wantsShirt/shirtSize` definidos na inscrição; valor da camisa embutido no pagamento único (`resolveBaseValue`).
- Conciliação `order_nsu = registration.id` impede segundo pagamento da mesma inscrição — o webhook confirmaria a inscrição, não a camisa. É exatamente o caso "1 inscrição → N pagamentos" resolvido pelo **ADR-001**: pedido `type = SHIRT_ONLY` com `targetRegistrationId`, `order_nsu = "ord_" + order.id`.
- Porta de entrada pública já existe: busca por CPF → `RegistrationProofModal` (comprovante).
- Incidente passado com rota pública expondo dados (commit `89ecf25`) — expor o mínimo.

## Proposta de UX (para aprovação — o requisito pede análise da melhor experiência)

1. Participante busca o comprovante por CPF (fluxo já existente e conhecido do público).
2. Se a inscrição é `CONFIRMED`, o evento tem camisa habilitada e ele **ainda não tem** camisa: o comprovante mostra um cartão "Quer a camisa do evento? — R$ XX" com botão **"Comprar camisa"**.
3. Toca → escolhe o tamanho (mesmos cartões do fluxo de inscrição) → **"Ir para o pagamento"** → checkout InfinitePay só do valor da camisa (mesmo redirecionamento/fallbacks iOS de hoje).
4. Webhook confirma → `wantsShirt = true`, `shirtSize` gravados → comprovante passa a exibir a camisa (e o histórico dos dois pagamentos).
5. Camisa com pagamento pendente: comprovante mostra "Pagamento da camisa pendente — continuar pagamento" (mesmo padrão de retomada do fluxo atual).

Por que essa UX: zero telas novas para o público aprender — reusa comprovante, cartões de camisa e checkout; o comprovante já é o "hub" do participante (decisão P-03: sem e-mail/WhatsApp, comprovante é o canal).

## Arquitetura proposta

- **Pedido**: `Order { type: SHIRT_ONLY, targetRegistrationId, eventId, totalValue = valorCamisa, status PENDING→CONFIRMED }` (schema do ADR-001, já criado no req. 2 — este req. não muda schema).
- **Valor da camisa** (sempre recalculado no servidor): `priceWithShirt − price` do **lote registrado na inscrição** (`batchId`, req. 3) ou do evento sem lote — coerente com o que o participante teria pago na inscrição (ver Q13 do req. 10). Adulteração de valor no client → irrelevante (client não envia valor).
- **Rota pública nova** `POST /api/payments/create-shirt-preference`: body `{ registrationId, cpf, shirtSize }`; valida CPF ↔ inscrição, `status = CONFIRMED`, camisa habilitada, `wantsShirt = false`, tamanho válido (`validateShirtSelection`), **sem pedido SHIRT_ONLY aberto** (idempotência) → cria `Order` + checkout. Entra em `publicRoutes` com justificativa. Resposta mínima: `checkoutUrl` + `orderId`.
- **Webhook** (branch `ord_` do req. 2): pedido `SHIRT_ONLY` confirmado → transação: `Order CONFIRMED` + `registration.update({ wantsShirt: true, shirtSize: order.paymentDetails.shirtSize })` + histórico. Conferência de valor pelo mesmo recálculo. Idempotente.
- **Retomada**: pedido `SHIRT_ONLY` `PENDING` → "continuar pagamento" do pedido (mecânica do req. 2); abandono não trava nova tentativa (o pedido aberto é reaproveitado/regenerado, nunca duplicado).
- **Busca por CPF / comprovante**: resposta pública ganha os campos mínimos para o cartão (camisa disponível? pedido de camisa pendente?) — sem valores de terceiros, sem dados extras.
- **Admin/financeiro**: origem da camisa visível ("na inscrição" × "compra posterior" — deriva de existir pedido `SHIRT_ONLY`); receita de camisa avulsa entra no req. 10 via `Order.totalValue`.

## Alternativas consideradas

- **Segunda `Registration` para a camisa**: descartada — duplicaria pessoa/CPF e contaminaria check-in e relatórios (o requisito veta duplicidade).
- **Atualizar `wantsShirt` antes do pagamento** (estado "camisa pendente" na inscrição): descartado — inscrição confirmada ficaria com camisa não paga aparecendo em relatórios de produção de camisa; o estado pendente vive no `Order`.
- **Cobrança manual pelo admin** (participante paga por Pix avulso e admin marca): já possível hoje via edição + observação (req. 1) — permanece como caminho de contingência, mas não substitui o autosserviço.

## Riscos e mitigação

- Duplo clique/pedidos duplicados → unicidade de pedido `SHIRT_ONLY` aberto por inscrição (checagem transacional).
- Pagamento da camisa com valor antigo após mudança de preço → conferência de valor no webhook com recálculo + salvaguarda de `transactionNsu` (seção 9.7 do RFC de lote).
- Exposição de dados na rota pública → validação CPF ↔ inscrição; resposta mínima; sem eco de dados pessoais.
- Estoque/prazo de camisas: comprar camisa às vésperas pode ser inviável para produção → Q14.
- R-03: inscrições legadas funcionam — o pedido de camisa é novo e independente do formato do pagamento original.

## Perguntas abertas

- **Q14**: precisa de **prazo limite** para compra posterior de camisa (ex.: data configurável no `shirtConfig`, após a qual o botão some)? (Recomendação: sim, campo opcional `purchaseDeadline` — produção de camisas tem prazo real.)
- **Q13** (req. 10): confirmar valor da camisa = diferença do lote da inscrição.

## Plano de implementação

1. (Pré-requisito: req. 2 entregue — `Order`, webhook `ord_`, retomada de pedido.)
2. Rota `create-shirt-preference` (Zod, validações, idempotência, `publicRoutes`).
3. Webhook: tratamento `SHIRT_ONLY` (transação + conferência de valor).
4. Busca por CPF/comprovante: campos mínimos do cartão de camisa + estados (disponível/pendente/comprada).
5. Frontend: cartão no comprovante + modal de tamanho + redirecionamento; estado "continuar pagamento da camisa".
6. Admin/financeiro: origem da camisa + receita avulsa (integra req. 10).
7. Se Q14 aprovada: `shirtConfig.purchaseDeadline` (schema Zod + EventModal + gate na rota).
8. Verificação (`tsc`/lint/build) + matriz abaixo; atualizar `docs/FLUXO_INSCRICAO.md` e este arquivo.

## Critérios de aceite / testes manuais

- Inscrito confirmado sem camisa → vê o cartão, compra, paga (sandbox), webhook confirma → comprovante com camisa e tamanho; financeiro soma a receita de camisa avulsa.
- Inscrito que já tem camisa → cartão não aparece; segunda compra → bloqueada.
- Pedido de camisa abandonado → "continuar pagamento" retoma sem duplicar; comprar de novo não cria segundo pedido.
- Evento sem camisa/gratuito → nada aparece.
- CPF divergente na rota → 403/404 sem vazar dados.
- Valor adulterado/link antigo → webhook rejeita/loga (salvaguardas do req. 2).
- Mobile (Instagram/iOS): fluxo completo com os fallbacks existentes.

## Checklist

- [x] ADR-001 aprovado e req. 2 implementado
- [x] Análise de UX proposta (aguardando aprovação do Ricardo)
- [x] Análise técnica completa (2026-07-24)
- [x] Q13/Q14 respondidas (ADR-003)
- [x] Backend (rota pública, webhook SHIRT_ONLY, retomada)
- [x] Frontend (comprovante, modal de tamanho, estados)
- [x] Idempotência / anti-duplicidade verificada
- [x] Testes (servidor local)
- [x] Documentação atualizada
- [ ] Aprovação do Ricardo

## Progresso / Arquivos alterados / Testes realizados / Pendências

### Implementado (2026-11-11)

- `backend/services/shirtPurchaseService.ts` (novo): `getShirtPurchaseView` (estado do cartão no comprovante) e `createOrReuseShirtOrder` (validações + `Order SHIRT_ONLY` sob lock do evento, reaproveitando pedido pendente).
- `app/api/payments/create-shirt-preference/route.ts` (nova, pública, em `publicRoutes`) + `backend/schemas/shirtPurchaseSchemas.ts`.
- `backend/services/batchRegistrationService.ts`: `confirmShirtOrder` no webhook `ord_` (valor, link obsoleto, idempotência, grava camisa na inscrição); helpers de confirmação compartilhados com o lote; `appendHistory` exportado.
- `backend/utils/shirtPricing.ts`: `resolveShirtOnlyValue`, `isShirtPurchaseOpen`. `ShirtConfigSchema.purchaseDeadline` (opcional) + campo no `EventModal`.
- `search-by-cpf`/`get-by-id`: `shirtPurchase`; `get-by-id` e `payments/status` resolvem `ord_` de camisa. `PaymentResultPage` com texto próprio.
- `components/registration/ShirtPurchaseCard.tsx` + integração no `RegistrationProofModal`.
- `app/api/admin/financial/route.ts`: inscrição com camisa comprada depois conta como "sem camisa" (valor entra só pelo pedido), evitando duplicar.

### Desvios do RFC

- Sem alteração de schema Prisma (como previsto). `infinitePayService`: parâmetro opcional `itemLabel` para reaproveitar `createInfinitePayCheckoutForOrder`.
- "Origem da camisa" no admin (item 6 do plano) não ganhou rótulo próprio: a receita avulsa aparece em "Camisas" do financeiro; indicador por inscrição fica como pendência.
- No financeiro, "com camisa" (contagem de produção) não inclui quem comprou depois; a quantidade aparece em "camisas avulsas".
- `GroupProofModal` não oferece o cartão (cada pessoa abre o próprio comprovante, que oferece).

### Testes (servidor local, gateway mockado, dados removidos ao final)

Compra com lote (62−40 = R$ 22,00, item 2200 centavos) e sem lote (80−50 = R$ 30,00, 3000); `order_nsu = ord_<id>`, customer com telefone E.164, redirect/webhook URLs corretos; sem tamanho 422, tamanho inválido 422, CPF errado 403, já com camisa 409, inscrição pendente 409, após o prazo 400; 4 requisições simultâneas geraram 1 pedido (demais reaproveitaram, tamanho atualizado); webhook: pago menor 422, amount obsoleto ignorado e registrado, correto confirma e grava `wantsShirt`/`shirtSize`, repetição "Já confirmado", valor pago com taxa (2300 > 2200) aceito; após compra o cartão some e segunda compra é bloqueada; `payments/status` e `get-by-id` resolvem `ord_`; financeiro: evento com lote bruto 62,00 (camisa 22,00, 1 avulsa), evento sem lote bruto 210,00 (camisas 60,00 incl. 30,00 avulsa), sem duplicar.

### Pendências

- Validação visual do cartão e do modal de tamanho em 375px/iOS (Instagram) não feita em navegador; checkout real da InfinitePay não chamado.
