# RFC — Inscrição em Lote (múltiplos participantes, um único pagamento)

**Status:** Proposto — revisão 2
**Autor da análise:** Claude Code (a pedido de Ricardo Mendes)
**Documento de origem:** `doc/ANALISE_DE_VIABILIDADE_DA_FEATURE_DE_INSCRICAO_EM_LOTE.md`
**Revisão 2:** incorpora decisões de produto discutidas após leitura da v1 — ver "Anexo — Registro desta revisão" ao final para o changelog completo.

---

## 1. Resumo Executivo

A funcionalidade é **viável e recomendada, com ajustes**. O sistema atual já resolve, para uma inscrição individual, praticamente todos os subproblemas que o lote precisa resolver N vezes: validação de campos fixos e dinâmicos, seleção de camisa com recálculo de preço no servidor, deduplicação por CPF, e um fluxo de checkout único (InfinitePay) desacoplado da confirmação (via webhook). Isso significa que a maior parte da lógica de validação **é reaproveitável em loop**, participante a participante.

O obstáculo real não é validação — é modelagem de pagamento. Hoje existe um pressuposto rígido, espalhado por várias camadas: **1 `Registration` = 1 checkout = 1 `order_nsu`** (o `order_nsu` do InfinitePay é literalmente o `id` da `Registration`). Não existe hoje nenhuma entidade que agrupe N inscrições sob um único pagamento. Introduzir essa entidade (`Order`) é o núcleo de todo o esforço de engenharia; o resto (formulário com N participantes, cálculo de total, webhook) decorre dela.

**Nesta revisão**, duas decisões de produto foram incorporadas e mudam partes relevantes do desenho original:

1. **UX simplificada**: em vez de um wizard novo e paralelo ao fluxo atual, o lote é adicionado como uma extensão do formulário existente (checkbox "Inscrever mais pessoas" + campo de quantidade + cards recolhíveis por participante), preservando exatamente a mesma contagem de etapas do fluxo de hoje (Dados → Camisa/Pagamento). Isso simplifica a implementação de frontend em relação à v1 (menos componentes novos, mais reaproveitamento direto do `EventRegistrationModal.tsx` existente).
2. **Cenário de pagamento pendente em grupo** (um participante quer se inscrever individualmente enquanto está "preso" dentro de um pedido em grupo abandonado por outra pessoa) exige uma nova operação de self-service — "sair do pedido e se inscrever individualmente" — com recálculo automático do pedido original. Esta é a mudança arquitetural mais significativa desta revisão (seções 6.3, 7.5, 9.6, 9.7).

Dois problemas preexistentes e independentes do lote continuam valendo como pré-requisitos (ver seção 17): ausência de `$transaction`/lock na checagem de vagas e dedup de CPF, e ausência de guarda de idempotência no webhook do Mercado Pago legado.

**Recomendação: ⚠️ Recomendo implementar, com os ajustes descritos nas seções 7, 17 e no plano de fases.** O escopo cresceu moderadamente nesta revisão (a operação de "sair do pedido" é engenharia nova, não só UI), mas continua sendo aditivo e não deveria bloquear o lançamento — só amplia o número de fases do plano de implementação.

---

## 2. Contexto

O sistema hoje serve milhares de usuários, ~99% em mobile, e permite apenas **uma inscrição por checkout**: o usuário preenche seus próprios dados, opcionalmente escolhe camisa, gera 1 checkout e paga. A confirmação chega depois, via webhook, e atualiza 1 `Registration`.

Casos de uso reais (pai inscrevendo a família, técnico inscrevendo o time, empresa inscrevendo funcionários) não são bem atendidos por esse modelo: hoje seria necessário repetir o fluxo inteiro N vezes, com N pagamentos separados.

### 2.1 Validação da documentação vs. código (regra obrigatória da análise)

Segui a regra de considerar o código como fonte de verdade sempre que houver divergência com a documentação. Divergências encontradas (inalteradas nesta revisão):

1. **`doc/ARQUITETURA.md` mostra um modelo `Registration`/`Event` desatualizado.** Faltam no doc campos que existem no `prisma/schema.prisma` real: em `Registration` — `paymentMethod`, `paymentError`, `paymentDetails`, `dynamicFormData`, `wantsShirt`, `shirtSize`, `updatedAt`; em `Event` — `registrationStartDate/EndDate`, `formMode`, `dynamicFormFields`, `fixedFieldsConfig`, `shirtConfig`, `paymentConfig`. O schema real (código) é o que foi usado nesta análise.
2. **Estrutura de rotas de pagamento divergente.** `ARQUITETURA.md` descreve `api/payments/{create, webhook, status}`. A árvore real é `create-preference/`, `update-preference/`, `webhook/` (Mercado Pago) + `webhook/infinitepay/`, `status/` — não existe pasta `create/`, e não existe `continue-payment/` (o "fluxo Continuar pagamento" citado em `FLUXO_INSCRICAO.md` é implementado por `update-preference/route.ts`).
3. **"Modo Mock" de pagamento descrito em `ARQUITETURA.md` e `GUIA_DESENVOLVIMENTO.md` está obsoleto.** Ambos descrevem um `MOCK_MODE` em `MercadoPagoCheckout.tsx` como fluxo ativo de simulação de pagamento. Na prática, o gateway ativo é o InfinitePay, com webhook real (`webhook/infinitepay/route.ts`), sem simulação — `MercadoPagoCheckout.tsx` é hoje legado/inativo (`AppSettings.activePaymentGateway = INFINITE_PAY` por padrão).
4. **Padrão "Controller → Repository → Prisma" não é seguido nas rotas críticas.** `ARQUITETURA.md` prescreve esse padrão para toda API nova. Na prática, `create-preference`, `create-free`, `update-preference`, os dois webhooks e a criação manual do admin chamam `prisma.registration.*` diretamente dentro do `route.ts` ("fat route handler"), sem passar por `RegistrationController` (que não existe) nem por `RegistrationRepository` (existe, mas não é usado nessas rotas).
5. **Conceito de "modalidade" não existe no código.** O documento de origem da análise cita "cada participante pode escolher sua modalidade" como parte do fluxo imaginado, mas não há nenhuma entidade `Modalidade`/campo equivalente no sistema atual — o que mais se aproxima é um campo dinâmico do tipo `select`/`radio` configurado pelo organizador. Tratado como fora de escopo nesta análise (ver seção 5).

---

## 3. Problema

Não é possível hoje cadastrar mais de uma pessoa em uma única compra. Isso obriga o responsável (pai, técnico, empresa) a repetir manualmente o formulário inteiro N vezes e efetuar N pagamentos separados — alto atrito, especialmente em mobile, e maior taxa de abandono quanto maior o grupo.

---

## 4. Objetivos

- Permitir que um usuário cadastre de 1 a N participantes em uma única sessão, **sem alterar a estrutura de etapas do fluxo atual** (mesmo número de steps de hoje).
- Gerar **um único checkout e um único pagamento** para o grupo inteiro.
- Ao confirmar o pagamento, confirmar **todas** as N inscrições atomicamente (nunca um subconjunto).
- Preservar 100% das regras já existentes por participante: campos fixos/dinâmicos, camisa, cálculo de preço no servidor, dedup por CPF, vagas, janela de inscrição.
- Não alterar o comportamento do fluxo individual existente (retrocompatibilidade total).
- **Novo nesta revisão**: garantir que um pedido em grupo abandonado por quem o iniciou não sequestre indefinidamente a capacidade dos demais participantes de se inscreverem — cada participante deve conseguir se desvincular e pagar sua própria parte, sem depender de uma ação de terceiros.

---

## 5. Fora de Escopo

- **"Modalidade" como entidade própria** — não existe hoje; se o organizador precisar dessa segmentação, já é possível modelar como campo dinâmico `select`/`radio`. Criar uma entidade `Modalidade` formal é uma feature independente, não faz parte deste RFC.
- **Migrar o fluxo Mercado Pago (legado) para suportar lote.** O gateway ativo é o InfinitePay; o MP só seria tocado se voltar a ser o gateway ativo. Não há ROI em dar suporte a lote num fluxo hoje inativo.
- **Parcelamento/seleção de método de pagamento por participante.** Isso não existe nem no fluxo individual atual (método/parcelas são escolhidos no checkout do gateway, fora do app).
- **Cancelamento parcial de um lote já confirmado** (ex.: cancelar 1 de 5 inscrições já pagas, com estorno proporcional) — é uma operação administrativa que pode ser resolvida manualmente no admin hoje (edição individual de `Registration`) e não bloqueia o lançamento da feature.
- **Fila assíncrona/job em background** para processar o lote — no tamanho de lote proposto (ver seção 15), tudo é resolvido de forma síncrona dentro de uma única requisição.
- **Cenário do "Responsável pela compra" não participar do evento** (pagar sem se inscrever). A escolha de terminologia (seção 7.4) deixa esse caminho aberto para o futuro, mas ele **não é implementado nesta fase** — hoje quem inicia o lote é sempre também o Participante 1.
- **Notificação automática dos demais participantes** quando alguém sai de um pedido pendente (seção 6.3/9.6). O responsável precisa checar o status manualmente (mesmo padrão pull-based já usado hoje via busca por CPF/comprovante) — adicionar notificação push/e-mail é melhoria futura, não bloqueante.

---

## 6. Alternativas Avaliadas

### 6.1 Modelagem de dados (unidade de pagamento)

| Alternativa | Descrição | Prós | Contras | Veredito |
|---|---|---|---|---|
| **A. Registration pai/filho** (auto-relacionamento, `parentId` na própria tabela) | Uma `Registration` "pai" sem dados de participante, várias "filhas" com `parentId` apontando pra ela | Não cria tabela nova | Mistura conceito de "pessoa inscrita" com "unidade de pagamento" na mesma tabela; `Registration` pai não representa uma pessoa real, é um caso especial que contamina toda query que hoje assume "toda Registration é uma pessoa" (relatórios, check-in, listagem admin) |
| **B. Order contendo inscrições** | Nova entidade `Order` (1:N com `Registration` via `orderId` opcional), unidade de pagamento e conciliação do gateway | Separa claramente "pessoa inscrita" de "unidade de pagamento"; `Registration` continua representando 1 pessoa, sem exceções; fluxo individual não muda (orderId fica `null`); natural para guardar total, status agregado, paymentId/paymentDetails do grupo | Uma tabela nova + 1 FK nova (mudança de schema, ainda que aditiva) | **Recomendada** |
| **C. Checkout contendo inscrições** | Igual à B, mas nomeada em torno do conceito de "checkout" | Nome mais explícito para o caso pago | Não cobre naturalmente lote **gratuito** (não há checkout em evento grátis); "Order" é mais neutro e cobre os dois casos | Descartada (nome, não estrutura) |
| **D. Payment compartilhado** (várias `Registration` apontam pro mesmo `paymentId`, sem tabela nova) | Reaproveita campo já existente | Zero schema novo | `paymentId` já tem significado ambíguo hoje (order_nsu no InfinitePay, preference_id no MP); sem tabela própria não há onde guardar total do grupo, status agregado, nem uma âncora de conciliação de webhook | Descartada |
| **E. Batch Registration** (endpoint especial que apenas faz loop de `create`, sem entidade agregadora) | N `Registration`s soltas, ligadas só por terem sido criadas na mesma request | Simples de implementar | Sem entidade agregadora, o webhook não tem como saber quais N registrations pertencem ao mesmo pagamento | Descartada |

**Escolha mantida: Alternativa B — `Order` contendo `Registration`s.** Esta decisão da v1 continua sendo a base de tudo o que segue; as duas seções abaixo tratam de decisões novas desta revisão, que se encaixam sobre essa mesma modelagem sem substituí-la.

### 6.2 Fluxo de preenchimento: wizard novo vs. extensão do formulário atual

A v1 deste RFC propunha um wizard dedicado ("Quantos participantes?" → lista de participantes → revisão → pagamento). A proposta desta revisão é substituí-lo por uma extensão inline do formulário já existente: checkbox "Inscrever mais pessoas nesta mesma compra" → campo de quantidade → cards recolhíveis renderizados no mesmo Step 1 de hoje.

| Critério | Wizard dedicado (v1) | Extensão inline (v2, proposta) |
|---|---|---|
| Nº de etapas percebidas pelo usuário | Maior (etapa extra "quantos participantes", possível etapa de revisão separada) | Igual ao fluxo atual (Dados → Camisa/Pagamento) |
| Carga cognitiva para usuário leigo em mobile | Introduz um padrão de navegação novo ("Participante 2 de 5", Próximo/Voltar) | Reaproveita o padrão já validado em produção (mesmo modal, mesmos botões) |
| Esforço de implementação | Maior — componente orquestrador novo, navegação não-linear | Menor — extensão de estado do componente existente para array, sem componente de navegação novo |
| Risco de regressão no fluxo individual | Baixo, mas por ser um componente paralelo, tende a divergir do componente principal ao longo do tempo | Baixíssimo — é o mesmo componente, o modo individual é só "quantidade = 1" (checkbox desmarcado) |

**Concordo com a mudança e a incorporo integralmente** — é estritamente melhor nos dois eixos que mais importam aqui (esforço cognitivo do usuário leigo e reaproveitamento de código), sem nenhuma perda técnica: a modelagem de dados (`Order`), os endpoints de backend e o webhook da seção 6.1 continuam exatamente os mesmos: a única coisa que muda é como o frontend monta o array de participantes antes de chamar esses endpoints. Detalhamento completo nas seções 10 e 11.

Um ajuste que **adiciono** (não estava no pedido original): o campo "Quantidade de participantes" precisa de um teto validado tanto no cliente quanto no servidor (`MAX_BATCH_SIZE`, recomendo 10 — ver seção 15 sobre por que 10 e não 20 nesta revisão), para impedir que alguém digite um número arbitrariamente grande e quebre a premissa de "tela única, sem paginação".

### 6.3 Participante em pedido pendente abandonado por outra pessoa

Este é o ponto que exige mais análise crítica. Cenário: João cria um pedido com João, Maria e Pedro (R$ 330, `PENDING`), abandona o checkout. Dias depois, Maria tenta se inscrever usando seu próprio CPF.

**Opção A — obrigar Maria a continuar o pagamento do pedido inteiro.**
Tecnicamente é a opção mais barata: é literalmente a mesma regra que já existe hoje para o fluxo individual (CPF com `PENDING` → oferece "continuar pagamento"), só que aplicada ao `Order` inteiro em vez de a uma `Registration` solta. Porém, o efeito colateral é sério: **Maria perde a autonomia sobre sua própria inscrição.** Ela fica de fato bloqueada até que uma decisão de terceiro (pagar por 3 pessoas, incluindo 2 que não são ela) seja tomada — e se João nunca mais voltar, Maria simplesmente não consegue se inscrever sozinha por tempo indefinido, mesmo quando ela pessoalmente está disposta a pagar sua parte agora. Isso é uma falha de produto real, não hipotética: é exatamente o tipo de atrito que motivou a feature de lote a existir.

**Opção B — permitir que Maria saia do pedido**, recalculando o pedido original e criando uma inscrição individual nova para ela.
Resolve o problema da Opção A, mas sozinha ela não cobre um caso simétrico: e se for o **próprio João** (quem preencheu e teria que pagar) que quer desistir só da parte dele, mantendo Maria e Pedro agrupados? A opção B, como formulada, não distingue "quem iniciou o pedido" de "qualquer membro do pedido" — na prática, a operação de sair é a mesma para qualquer participante, incluindo quem preencheu originalmente. Isso é bom (evita criar um conceito de "dono do pedido" que não existe hoje na modelagem), mas precisa ser dito explicitamente, porque não estava claro no pedido original.

**Minha recomendação não é a Opção B pura — é uma Opção C: oferecer as duas ações ao participante afetado, e não escolher uma regra rígida única.**

Justificativa: o sistema não tem como saber, sem perguntar, se Maria quer "assumir e pagar pelo grupo inteiro" (às vezes é exatamente isso que ela quer — talvez ela e João tenham combinado que ela pagaria) ou "sair e resolver sozinha". Impor uma única resposta correta nos dois sentidos é pior do que perguntar. A engenharia nova real está inteiramente na Opção B (o mecanismo de "sair e recalcular"); a Opção C só adiciona, de graça, o botão que já existe hoje ("continuar pagamento do grupo") ao lado do botão novo. Não há custo de engenharia adicional em oferecer as duas — o custo está todo em construir o mecanismo de saída, que precisa existir de qualquer forma para dar a Maria uma saída real.

**Opção D — não implementar self-service; deixar a resolução para o admin** (edição manual da inscrição/pedido pelo painel administrativo, que já existe hoje). É a opção de menor esforço de engenharia. Cito-a explicitamente porque é uma redução de escopo legítima para uma primeira versão: se o time preferir lançar o lote sem o mecanismo de saída self-service, o pior caso é que Maria precisa abrir um chamado com o organizador, que resolve manualmente no admin — pior experiência, mas não bloqueante para o lançamento do lote em si. Trato isso como **decisão de faseamento**, não como alternativa definitivamente descartada — ver Fase 6 do plano de implementação, que pode ser adiada sem impedir o lançamento das Fases 0–5 e 7.

**Decisão adotada nesta revisão: Opção C, com a Opção D como redução de escopo aceitável para uma primeira entrega caso o prazo aperte.** Arquitetura completa na seção 7.5 e 9.6.

---

## 7. Arquitetura Recomendada

### 7.1 Visão geral

Introduzir `Order` como unidade de pagamento, substituindo o papel que `Registration.id` hoje desempenha como `order_nsu`. O fluxo individual atual **não muda uma linha** — `Registration.orderId` fica `null` para todo o histórico e para novas inscrições avulsas. O lote é aditivo, não uma reescrita.

```
Fluxo individual atual (inalterado):
  Registration (orderId = null) ──── order_nsu = registration.id

Fluxo em lote (novo):
  Order (id, status, paymentId, totalValue) ──── order_nsu = "ord_" + order.id
    ├── Registration #1 — Responsável pela compra (orderId = order.id)
    ├── Registration #2 (orderId = order.id)
    └── Registration #3 (orderId = order.id)
```

### 7.2 Por que prefixar o `order_nsu` (`ord_<id>`) em vez de fallback sequencial

O relatório de exploração do webhook do InfinitePay mostrou que ele resolve a `Registration` só por `id` (busca direta), sem ambiguidade hoje porque só existe um tipo de emissor de `order_nsu`. Ao introduzir `Order`, duas estratégias são possíveis:
- **(a) Fallback sequencial**: tentar achar um `Order` com aquele id; se não achar, tentar achar uma `Registration`. Funciona, mas depende da ordem de busca e do não-vazamento de colisão de `cuid()` entre tabelas (extremamente improvável, mas evitável).
- **(b) Prefixo determinístico**: todo `order_nsu` de lote é gerado como `"ord_" + order.id`; o parser do webhook decide o roteamento por prefixo, sem depender de "não achou, então deve ser o outro caso". Mais explícito, mais fácil de testar, zero ambiguidade.

**Recomendado: (b).**

### 7.3 Impacto na arquitetura, manutenção e legibilidade

- **Arquitetura**: aditivo. Nenhuma rota existente muda de contrato. `Order` é uma tabela nova + uma FK nova opcional.
- **Manutenção**: como as rotas de pagamento hoje já são "fat route handlers" sem `Controller`/`Repository` (divergência #4 da seção 2.1), o caminho pragmático — dado o requisito explícito de "evitar abstrações desnecessárias" — é **não** forçar a criação de um `RegistrationController` novo só para o lote; em vez disso, extrair a lógica de validação por-participante (evento ativo/janela/vaga/CPF/camisa/dinâmico) para uma função pura compartilhada (ex.: `backend/services/registrationValidation.ts`) que tanto o fluxo individual quanto o de lote podem chamar em loop. Isso reduz duplicação sem introduzir uma camada nova de abstração arquitetural.
- **Escalabilidade**: `Order` não introduz gargalo — é 1 linha extra por checkout de lote, e as N `Registration`s continuam sendo a mesma tabela de sempre (relatórios, check-in, listagem admin funcionam sem alteração, só ganham um `orderId` opcional).
- **Legibilidade**: quem lê `Registration.orderId === null` sabe imediatamente que é uma inscrição avulsa; `orderId !== null` sinaliza que faz parte de um grupo — dado explícito, não inferido.
- **Futuras funcionalidades**: `Order` vira o lugar natural para, no futuro, funcionalidades como cupom de desconto por grupo, nota fiscal consolidada, ou relatório financeiro "por pedido" — sem precisar tocar `Registration`.

### 7.4 Terminologia: "Responsável pela compra"

Adoto **"Responsável pela compra"** como termo padrão em toda a UI e nesta documentação, em vez de "pagador" (mais informal e menos preciso) ou "Responsável pela inscrição" (ambíguo — pode ser confundido com o organizador do evento, que também "é responsável" pela inscrição em outro sentido).

"Responsável pela compra" tem uma vantagem técnica concreta, não só estética: ele nomeia corretamente a unidade que a arquitetura da seção 7.1 já modela — o `Order` é a "compra"; o "responsável" é, por enquanto, sempre também o Participante 1 dentro dela. Ao não usar "pagador" nem amarrar o nome a "quem preenche o formulário", fica aberta — sem nenhum custo de modelagem adicional — a extensão futura mencionada na seção 5 (alguém pagar sem se inscrever): bastaria, no futuro, permitir que um `Order` exista sem que o Responsável tenha uma `Registration` própria associada — o modelo já suporta isso porque `Order` e `Registration` já são entidades desacopladas.

### 7.5 Saída de um participante de um pedido pendente (arquitetura)

Decisão da seção 6.3: qualquer participante de um `Order` `PENDING` pode se desvincular e virar uma inscrição individual — a mesma operação vale tanto para o Responsável pela compra quanto para qualquer outro participante, sem distinção (não existe conceito de "dono do pedido" na modelagem, e não introduzo um só para isto).

**Mecânica**: sair de um pedido é, na prática, **reverter a `Registration` daquela pessoa para o mesmo estado de uma inscrição individual comum** (`orderId = null`), e então deixá-la seguir pelo fluxo de "continuar pagamento" **que já existe hoje** para inscrições avulsas — nenhum código novo de geração de checkout individual é necessário, porque `order_nsu = registration.id` já é o comportamento padrão quando `orderId` é `null`.

O que precisa de lógica nova é o que acontece com o `Order` de origem:

1. **Recalcular o total**: `Order.totalValue = soma(resolveBaseValue(evento, participante.wantsShirt))` para os participantes que restaram — mesma função (`resolveBaseValue`) já usada em todo o resto do fluxo, sem novas fórmulas.
2. **Invalidar o link de checkout atual**: como o total mudou, o link já gerado (se algum foi gerado) está desatualizado. `Order.paymentId` é limpo (`null`); o Responsável (ou quem checar o status do pedido depois) precisa gerar um novo link antes de poder pagar de novo — reaproveitando a mesma operação de "continuar pagamento" da seção 9.4/Fase 5, sem lógica nova de geração de link.
3. **Pedido esvaziado**: se o participante que sai for o último remanescente, o `Order` inteiro passa para `CANCELLED` em vez de ficar `PENDING` com total zero (caso de borda tratado explicitamente na seção 13).
4. **Auditoria**: cada saída é registrada como uma entrada em `Order.paymentDetails.history[]` (campo `Json?` que já existe no modelo, reaproveitado — não crio tabela de auditoria nova para isto). Exemplo de entrada: `{ event: "participant_left", registrationId, at: "2026-07-06T...", previousTotal: 330, newTotal: 210 }`.
5. **Concorrência**: a saída só é permitida enquanto `Order.status === PENDING`; a operação inteira (recontar remanescentes, recalcular total, invalidar paymentId) roda dentro de uma `$transaction` com lock no `Order` (mesma técnica de lock recomendada na seção 9.5 para vagas), para não colidir com uma confirmação de pagamento chegando ao mesmo tempo pelo webhook.

**Risco novo identificado nesta revisão (não fazia parte do pedido original, mas decorre diretamente dele): link de checkout obsoleto pago após o recálculo.** Se um link já tinha sido gerado para R$ 330 antes de Maria sair, e alguém (o Responsável, sem saber que o pedido mudou) efetivamente paga aquele link antigo depois do recálculo para R$ 210, o webhook vai receber uma confirmação de pagamento de R$ 330 para um pedido cujo valor esperado agora é R$ 210. A validação de valor hoje só rejeita pagamentos **menores** que o esperado (`paidCents + 1 < expectedCents`) — um valor **maior** passaria a validação normalmente, confirmando o pedido "certo" mas deixando o comprador com R$ 120 pagos a mais sem nenhuma contrapartida. Trato isso na seção 9.7 com uma salvaguarda adicional (comparar a referência de transação recebida com o `paymentId` atualmente válido do `Order`, não só o valor).

Não sei, sem verificar a documentação/API atual do InfinitePay, se é possível desativar programaticamente um link de checkout já gerado. **Isso fica registrado como questão em aberto a validar na Fase 6 do plano de implementação** — a salvaguarda da seção 9.7 funciona independentemente da resposta, mas se a API permitir invalidação ativa do link, é uma camada de proteção adicional a preferir.

---

## 8. Modelagem de Dados

```prisma
model Order {
  id             String        @id @default(cuid())
  eventId        String
  event          Event         @relation(fields: [eventId], references: [id], onDelete: Cascade)
  status         RegistrationStatus @default(PENDING) // reaproveita o mesmo enum já usado por Registration
  paymentMethod  PaymentMethod @default(INFINITE_PAY)
  paymentId      String?       // providerRef do InfinitePay (order_nsu sem o prefixo "ord_"); null == "precisa gerar novo link"
  paymentError   String?
  paymentDetails Json?         // inclui breakdown do gateway + history[] de eventos (saída de participante, recálculo)
  totalValue     Float
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  registrations  Registration[]

  @@map("orders")
}

model Registration {
  // ...todos os campos atuais inalterados...
  orderId        String?
  order          Order?   @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@map("registrations")
}
```

Notas de modelagem:
- `Order.status` reaproveita o enum `RegistrationStatus` já existente (`PENDING|CONFIRMED|CANCELLED|PAYMENT_FAILED`) — evita criar um enum paralelo com os mesmos 4 valores.
- `Registration.orderId` é **opcional** — migration 100% aditiva, sem backfill necessário (linhas existentes ficam `null`).
- `onDelete: Cascade` em `Registration.orderId → Order.id` espelha o padrão já usado em `Registration.eventId → Event.id`.
- Índice em `orderId` para a query "buscar todas as registrations de um pedido" (usada no webhook, na tela de comprovante consolidado, e na operação de saída/recálculo da seção 7.5).
- **Nesta revisão, `paymentDetails` ganha uma responsabilidade nova**: além do breakdown de gateway (uso já previsto na v1), passa a acumular um `history[]` de eventos de saída/recálculo (seção 7.5) — decisão deliberada de reaproveitar um campo `Json?` já existente em vez de criar uma tabela de auditoria dedicada, consistente com "evitar abstrações desnecessárias".
- **Recomendação adicional (defesa em profundidade, não bloqueante):** avaliar um índice único parcial via SQL manual na migration — `CREATE UNIQUE INDEX ... ON registrations (event_id, cpf) WHERE status = 'CONFIRMED'` — para reforçar a nível de banco a regra "1 CPF confirmado por evento", já que hoje isso só existe como checagem de aplicação. Não é obrigatório para o lançamento, mas mitiga diretamente a race condition documentada na seção 17.
- Não é necessário criar tabela para "itens" do pedido — cada `Registration` já carrega seu próprio `wantsShirt`/`shirtSize`, que é o único fator que varia o preço por participante.

---

## 9. Fluxo Backend

### 9.1 Novo endpoint pago: `POST /api/payments/create-batch-preference`

Endpoint novo (não uma modificação de `create-preference`, para não arriscar o fluxo individual em produção). Reaproveita as mesmas funções puras já usadas hoje: `validateShirtSelection`/`resolveBaseValue` (`backend/utils/shirtPricing.ts`), `validateDynamicFormData` (`backend/utils/dynamicFormValidator.ts`), `isValidCpf`/`validateCpfDigits` (`utils/cpfValidator.ts`).

```
1. Body: { eventId, participants: Participant[] } // 1 a MAX_BATCH_SIZE itens
2. event = findUnique(eventId, { include: _count.registrations })
3. Validações no nível do evento (idênticas às de create-preference):
   isActive, !isFree, formMode !== DYNAMIC_ONLY, janela de inscrição
4. Validação de tamanho do lote: 1 <= participants.length <= MAX_BATCH_SIZE (ex.: 10)
5. prisma.$transaction(async (tx) => {
     a. SELECT ... FOR UPDATE no evento (via $queryRaw, ou reforçar isolation: "Serializable")
        para travar a leitura de vagas durante a transação
     b. vagasDisponiveis = event.maxParticipants - count(registrations do evento)
        if (participants.length > vagasDisponiveis) throw "Vagas insuficientes"
     c. Para cada participant (com índice, erros agregados por índice — não falha no 1º erro):
        - valida CPF (isValidCpf)
        - valida dedup: já existe Registration CONFIRMED desse CPF nesse evento? throw
        - valida se o CPF já pertence a um Order PENDING de outra pessoa → throw
          ("esta pessoa já possui uma inscrição pendente; peça para que ela mesma acesse com
          seu CPF para resolver antes de ser incluída em um novo grupo" — ver seção 6.3/13)
        - valida duplicidade DENTRO do próprio array (dois participantes com mesmo CPF no
          mesmo lote) → throw
        - valida camisa (validateShirtSelection) e resolve valor (resolveBaseValue)
        - valida campos dinâmicos (validateDynamicFormData) se formMode === BOTH
     d. Se qualquer participante inválido → throw (nada é persistido; erro devolve lista
        de erros por índice, ex.: [{ index: 2, field: "cpf", message: "..." }])
     e. totalValue = soma dos valores resolvidos de todos os participantes
     f. order = tx.order.create({ eventId, status: PENDING, paymentMethod: INFINITE_PAY, totalValue })
     g. tx.registration.createMany({ data: participants.map(p => ({ ...p, eventId,
        orderId: order.id, status: PENDING, paymentMethod: INFINITE_PAY })) })
        // createMany não retorna os registros — se precisar dos ids logo em seguida
        // (ex. para o comprovante), usar Promise.all(participants.map(p => tx.registration.create(...)))
        // dentro da mesma transação em vez de createMany
   })
6. checkout = createInfinitePayCheckoutForOrder({
     orderNsu: "ord_" + order.id,
     items: participants.map(p => ({ description: p.name, quantity: 1, price: resolveBaseValue(...) })),
     ...
   })
7. order.paymentId = checkout.providerRef (update fora da transação de criação, mesmo padrão
   já usado em create-preference: primeiro persiste PENDING, depois grava a referência do gateway)
8. Retorna { orderId: order.id, checkoutUrl }
```

Reaproveitamento explícito: `createInfinitePayCheckoutForOrder` é uma função nova, mas a API do InfinitePay **já suporta múltiplos itens** por link (`items: [...]`, confirmado em `lib/infinitepay.ts`) — não é preciso negociar nada novo com o gateway, só compor o array de itens a partir dos N participantes.

### 9.2 Novo endpoint gratuito: `POST /api/registrations/create-free-batch`

Mais simples — não precisa de `Order` (não há gateway envolvido, nada para conciliar depois). Reaproveita a mesma validação por participante do fluxo pago (evento gratuito, `fixedFieldsConfig`, dedup, dinâmico), mas dentro de uma única `$transaction` que:
1. Trava a leitura de vagas (mesmo lock da seção 9.1).
2. Valida `participants.length <= vagasDisponiveis`.
3. Valida cada participante (mesma lógica de erros agregados por índice, incluindo a checagem de "CPF já em outro pedido pendente" da seção 9.1c).
4. Cria as N `Registration`s com `status: CONFIRMED`, `paymentMethod: FREE`, `paymentId: free_<timestamp>_<rand>_<index>`, sem `orderId`.

### 9.3 Webhook InfinitePay estendido

`webhook/infinitepay/route.ts` ganha um branch no início do parsing:

```
parsed = parseInfinitePayWebhook(body)
if (parsed.orderNsu.startsWith("ord_")) {
  orderId = parsed.orderNsu.slice(4)
  order = tx.order.findUnique({ id: orderId, include: { registrations: true } })
  if (!order) → 404 (mesmo comportamento de hoje pra registration não encontrada)
  if (order.status === "CONFIRMED") return { received: true, message: "Já confirmado" } // idempotência, igual hoje
  // Seção 9.7: salvaguarda contra link obsoleto pago após recálculo
  if (order.paymentId && order.paymentId !== parsed.transactionNsu) {
    → não confirma automaticamente; loga para reconciliação manual; responde 200 (evita reentrega)
  }
  expectedCents = sum(resolveBaseValue(event, r.wantsShirt) para cada r em order.registrations) * 100
  valida paidCents >= expectedCents (mesma tolerância de hoje)
  prisma.$transaction([
    tx.order.update({ status: CONFIRMED, paymentId: transactionNsu, paymentDetails }),
    tx.registration.updateMany({ where: { orderId }, data: { status: CONFIRMED, paymentId: transactionNsu } })
  ])
} else {
  // caminho existente, inalterado: busca Registration por id = orderNsu
}
```

Isso preserva 100% do comportamento atual para pagamentos individuais (branch `else` idêntico ao código hoje) e estende o mesmo padrão de idempotência e validação de valor já existente — só que somando N participantes em vez de recalcular 1, mais a salvaguarda nova de referência de transação (seção 9.7).

### 9.4 "Continuar pagamento" para um lote

`update-preference/route.ts` hoje gera um novo link reaproveitando `registration.id` como `order_nsu`. Para lote, a mesma lógica se aplica trocando `registration.id` por `"ord_" + order.id`: se o `Order` está `PENDING`, gera novo checkout do InfinitePay com os itens correspondentes aos participantes **atuais** (após qualquer saída/recálculo da seção 9.6) e atualiza `order.paymentId`. Não há necessidade de reeditar participantes nesse fluxo (mesmo comportamento do individual: dados ficam readonly, só se gera um novo link de pagamento).

### 9.5 Transação como pré-requisito, não boa-prática opcional

Vale destacar: **hoje, em produção, o fluxo individual já não usa `$transaction` em lugar nenhum** (confirmado por busca no repositório inteiro). A introdução do lote é a oportunidade natural de consertar isso, porque sem transação a checagem de vagas para N participantes é ainda mais arriscada do que para 1. Recomendo que essa correção (`$transaction` com lock na leitura de vagas) seja aplicada tanto nos novos endpoints de lote quanto, se o tempo permitir, retroativamente em `create-preference`/`create-free` — mas isso é uma melhoria independente, não bloqueia o lançamento do lote.

### 9.6 Novo endpoint: `POST /api/registrations/:id/leave-order`

Implementa a arquitetura descrita na seção 7.5.

```
1. registration = findUnique(id, { include: { order: { include: { registrations: true } } } })
2. if (!registration.orderId) → 400 "esta inscrição não pertence a um pedido em grupo"
3. if (registration.status !== "PENDING") → 400 "só é possível sair de um pedido com pagamento pendente"
4. prisma.$transaction(async (tx) => {
     a. order = tx.order.findUnique({ id: registration.orderId, include: { registrations: true } },
        { lock apropriado, ex.: SELECT ... FOR UPDATE })
     b. if (order.status !== "PENDING") → 409 "este pedido já foi confirmado ou cancelado"
        // race: cobre o caso do webhook confirmar o pedido entre a leitura inicial e o lock
     c. tx.registration.update({ where: { id }, data: { orderId: null } })
        // a Registration da pessoa que sai NÃO é apagada nem recriada — ela simplesmente
        // volta a se comportar como uma inscrição individual comum (orderId null), e
        // segue o fluxo de "continuar pagamento" já existente para gerar seu próprio checkout
     d. remaining = order.registrations.filter(r => r.id !== id)
     e. if (remaining.length === 0) {
          tx.order.update({ status: "CANCELLED", paymentId: null })
        } else {
          newTotal = sum(resolveBaseValue(event, r.wantsShirt) for r in remaining)
          tx.order.update({
            totalValue: newTotal,
            paymentId: null, // invalida o link atual — força nova geração antes de novo pagamento
            paymentDetails: { ...append history[] com o evento de saída e novo total }
          })
        }
   })
5. Resposta: { success: true, data: { registrationId, newOrderTotal, remainingParticipants } }
   Frontend redireciona a pessoa que saiu para o fluxo individual normal de "continuar pagamento"
   (gera checkout próprio usando o registration.id dela, já sem orderId).
```

### 9.7 Salvaguarda contra link de checkout obsoleto (webhook)

Complementa a seção 9.3. Antes de confirmar um `Order` via webhook, comparar a referência de transação recebida (`transactionNsu`) com o `Order.paymentId` **atualmente armazenado**:

- Se coincidem → confirma normalmente (fluxo feliz, inclusive quando nunca houve recálculo).
- Se **não** coincidem (ex.: alguém pagou um link antigo, gerado antes de um participante sair e o pedido ser recalculado) → **não confirma automaticamente**. Registra o evento (log + opcionalmente grava em `paymentDetails.history[]` do `Order` como `{ event: "stale_payment_received", ... }`) para reconciliação manual, e responde 200 ao gateway (evita reentregas indefinidas do mesmo webhook).

Esta checagem é adicional à validação de valor já existente (`paidCents >= expectedCents`) — sozinha, a validação de valor **não** cobre o caso em que o valor pago é maior que o esperado (only rejects underpayment), que é exatamente o que acontece quando um link antigo (de um total maior) é pago depois que o pedido encolheu.

---

## 10. Fluxo Frontend

**Revisado nesta versão**: substituído o wizard dedicado da v1 por uma extensão inline do `EventRegistrationModal.tsx` existente, conforme decisão da seção 6.2.

Reaproveitamento identificado no componente atual:

- **`RegistrationForm.tsx`** (campos fixos) e **`DynamicFormRenderer.tsx`** (campos dinâmicos) já são componentes controlados independentes, recebendo `form`/`value`/`onChange` — podem ser renderizados **N vezes**, um por participante, sem nenhuma alteração de assinatura.
- **`useCpfVerification`** já é um hook parametrizado por `eventId` — instanciado (ou chamado) uma vez por card de participante.
- **Padrão de lista dinâmica já existe no admin**: `Form.List` do Ant Design é usado hoje em `components/admin/EventModal.tsx` (linha ~654) para tamanhos de camisa. É o padrão mais idiomático para "adicionar/remover participante" — cada `field` do `Form.List` vira um card de participante, com paths aninhados (`name={[field.name, "cpf"]}`, `name={[field.name, "dynamicFormData", fieldId]}`) suportados nativamente pelo Ant Design.
- **Máscaras de CPF/telefone** hoje estão duplicadas entre `RegistrationForm.tsx` e `DynamicFormRenderer.tsx` — antes de multiplicar por N participantes, vale extrair para um util único (`utils/masks.ts`).

### 10.1 Estrutura do Step 1 ("Dados") — sem wizard, sem "Participante N de M"

O Step 1 continua sendo o mesmo Step 1 de hoje. O que muda é o que ele renderiza:

```
Step "Dados" (idêntico em posição ao fluxo atual)
┌─────────────────────────────────────────────┐
│ ▼ Responsável pela compra                    │  ← sempre expandido, é o participante 1
│   Nome, CPF, Telefone, Email, [dinâmicos]    │
│                                               │
│  ☐ Inscrever mais pessoas nesta mesma compra │  ← novo checkbox
│                                               │
│  (ao marcar, aparece:)                        │
│  Quantidade de participantes  [ 3 ]          │  ← numérico, min 2, max MAX_BATCH_SIZE (10)
│                                               │
│  ▶ Participante 2                             │  ← recolhido por padrão (accordion)
│  ▶ Participante 3                             │  ← recolhido por padrão
│                                               │
│  [Avançar]                                    │  ← mesmo botão de sempre
└─────────────────────────────────────────────┘
```

Comportamento do campo de quantidade: altera reativamente o número de cards recolhidos abaixo (aumentar adiciona cards vazios ao final; diminuir remove os últimos, com confirmação — `Modal.confirm` do Ant Design, já usado em outros pontos do admin — se o card a ser removido já tiver dados preenchidos). Nenhuma navegação "Próxima pessoa"/"Pessoa anterior" — o usuário abre e fecha os cards livremente, como um accordion comum.

Cada card de participante (2..N) contém exatamente os mesmos campos de `RegistrationForm.tsx`/`DynamicFormRenderer.tsx` do participante 1, incluindo verificação de CPF em tempo real (`useCpfVerification`) — se o CPF de um card específico já tiver uma inscrição `CONFIRMED` ou pertencer a um `Order` `PENDING` de outra pessoa, **só aquele card** fica bloqueado com a mensagem apropriada; os demais cards e o botão "Avançar" seguem funcionando normalmente.

Ação de conveniência (conforme pedido): botão "Usar meus dados de contato" em cada card 2+, que copia email/telefone do Responsável pela compra (nunca nome/CPF — cada pessoa é uma identidade distinta).

### 10.2 Step 2 ("Camisa"/"Pagamento" ou "Confirmar inscrição") — por participante

Preserva exatamente a posição e o propósito do Step 2 de hoje. A diferença é que, quando há mais de um participante, a mesma UI de escolha de camisa (cartões "sem camisa"/"com camisa" já existentes em `EventRegistrationModal.tsx`) é repetida por participante:

```
Step "Pagamento" (evento pago, idêntico em posição ao fluxo atual)

  Participante 1 — Responsável pela compra
  ○ Sem camisa (R$ 90)   ○ Com camisa (R$ 120) → [tamanho]

  ────────────────────────────────

  Participante 2
  ○ Sem camisa (R$ 90)   ○ Com camisa (R$ 120) → [tamanho]

  ────────────────────────────────

  Participante 3
  ○ Sem camisa (R$ 90)   ○ Com camisa (R$ 120) → [tamanho]

  ────────────────────────────────
  Total: R$ 330

  [Ir para o pagamento]   ← mesmo botão de sempre, mesmo redirecionamento
```

Esta mesma tela já cumpre o papel de "revisão antes do pagamento" citado nos requisitos originais — não é necessária uma etapa de revisão separada, porque a lista de participantes + total já está visível aqui antes do clique final. Para evento **gratuito**, o Step 2 equivalente ("Confirmar inscrição") lista os N participantes com seus dados e respostas dinâmicas, sem cartões de camisa (que não existem em evento grátis), e finaliza com o mesmo botão "Finalizar Inscrição" de hoje.

Depois disso, **o redirecionamento para o checkout é idêntico ao atual** — 1 clique, 1 checkout, sem mudança na lógica de `redirectToPayment`/fallback manual iOS/Instagram (`utils/paymentRedirect.ts`, reaproveitado sem alteração).

### 10.3 Alerta de CPF em pedido pendente em grupo (Opção C da seção 6.3)

`ExistingRegistrationAlert.tsx` ganha uma variante nova para quando o CPF encontrado pertence a uma `Registration` com `orderId` preenchido (parte de um grupo): em vez de só "Continuar pagamento", mostra as duas ações lado a lado:

```
Você já faz parte de uma inscrição em grupo (com Maria e Pedro),
pagamento pendente de R$ 330.

[ Continuar pagamento do grupo ]   [ Sair do grupo e inscrever-me sozinho(a) — R$ 120 ]
```

A segunda ação chama `POST /api/registrations/:id/leave-order` (seção 9.6) e, em seguida, encaminha a pessoa para o fluxo individual padrão de "continuar pagamento" (gera checkout próprio). Isso só é exibido quando a pessoa está resolvendo **sua própria inscrição** via CPF (fluxo individual) — dentro do preenchimento de um lote **novo**, um CPF que já pertence a outro pedido pendente apenas bloqueia aquele card (seção 10.1), sem oferecer a opção de "sair", para não permitir que uma pessoa desvincule outra de um grupo sem ser ela mesma a agir.

---

## 11. Fluxo Mobile

Dado que 99% do tráfego é mobile e o público tem baixa familiaridade com tecnologia, o desenho desta revisão prioriza deliberadamente **manter o número de telas e cliques do fluxo atual**, evitando qualquer padrão de navegação novo:

- **Mesmo modal, mesmos 2 steps de hoje** ("Dados" → "Pagamento"/"Confirmar") — nenhum step novo é introduzido; o lote só faz esses 2 steps carregarem mais conteúdo quando há mais de 1 participante.
- **Sem indicador "Participante N de M"** e sem botões "Próximo participante"/"Participante anterior" — só existe navegação entre os 2 steps macro de sempre, exatamente como hoje.
- **Accordion com apenas 1 card aberto por vez** reduz drasticamente o scroll: o Responsável pela compra sempre começa expandido (é quem já está preenchendo); os demais participantes começam recolhidos (▶), e o usuário abre um de cada vez para preencher — nunca há N formulários completos abertos simultaneamente na tela.
- **Erros de validação sinalizados no card recolhido** (badge/ponto vermelho no título do card, ex.: "▶ Participante 2 ⚠") — permite pular direto para o card com problema em vez de rolar tudo procurando o erro.
- **Botões e touch targets preservados** (48–64px, já padronizados em `RegistrationForm.tsx`) — nada muda na ergonomia de toque já validada em produção.
- **"Usar meus dados de contato"** como redutor de atrito explícito (seção 10.1) — 1 toque preenche email/telefone dos demais participantes a partir do Responsável.
- **Total sempre visível no Step 2**, atualizado reativamente conforme camisas são escolhidas — cumpre o papel de revisão final sem precisar de uma tela extra dedicada a isso.
- **Fallback de pagamento manual (iOS/Instagram)** é reaproveitado sem alteração — ainda é 1 única URL de checkout ao final, independentemente de quantos participantes.

---

## 12. Compatibilidade com funcionalidades existentes

| Funcionalidade | Impacto |
|---|---|
| Evento gratuito | Novo endpoint `create-free-batch`, mesma validação em loop; endpoint individual inalterado |
| Evento pago | Novo endpoint `create-batch-preference`; endpoint individual inalterado |
| Campos fixos | Reaproveitados via `RegistrationForm.tsx` renderizado N vezes |
| Campos dinâmicos (8 tipos) | `validateDynamicFormData` chamada em loop, 1x por participante, sem mudança de assinatura |
| Validações existentes | Todas reaproveitadas como funções puras |
| Validação de CPF | Reaproveitada; adicionada checagem de duplicidade **dentro do próprio lote** e de pertencimento a outro `Order` pendente |
| Deduplicação por CPF | Reaproveitada por participante; ver seção 17 sobre necessidade de lock |
| Seleção de camisa | Reaproveitada por participante, agora exibida em Step 2 por participante; total passa a ser somatório |
| Cálculo de preço só no backend | Preservado — nunca confia no client, agora soma N valores recalculados |
| Disponibilidade de vagas | Checagem estendida para `N <= vagasDisponiveis`, dentro de transação (ver seção 17) |
| Período de inscrição | Reaproveitado sem alteração |
| Webhook | Estendido com branch por prefixo `ord_` + salvaguarda de referência de transação (9.7); caminho individual (`else`) idêntico ao atual |
| Recuperação de pagamento | `update-preference` ganha equivalente para `Order` (mesmo padrão, novo link reaproveitando `order_nsu`) |
| Fluxo "Continuar pagamento" | Estendido para `Order` (seção 9.4); fluxo individual inalterado |
| Geração de comprovantes | Comprovante de lote agrega N registrations do mesmo `orderId`; comprovante individual inalterado |
| Segurança contra manipulação de valores | Preservada — todo valor é recalculado no servidor, nunca aceito do cliente |
| **Novo: pedido pendente abandonado** | Participante pode sair e recalcular o pedido original (seção 7.5/9.6); demais participantes e fluxo individual não são afetados |
| **Novo: terminologia** | "Responsável pela compra" usado consistentemente na UI; não é uma mudança de comportamento, só de rótulo |

---

## 13. Casos de Borda

| Caso | Tratamento |
|---|---|
| CPF já inscrito (CONFIRMED, fora do lote) | Bloqueia aquele participante especificamente; demais seguem válidos; erro retornado com índice |
| CPF repetido dentro do próprio lote | Validação nova: rejeita o lote inteiro antes de persistir, apontando os índices duplicados |
| **CPF de um participante do lote já pertence a outro `Order` PENDING** | Bloqueia aquele card específico com mensagem direcionando a pessoa a resolver sua própria pendência primeiro (não é possível transferir alguém de um grupo pendente para outro no mesmo ato) |
| Email/telefone repetido entre participantes | Permitido — família/grupo pode compartilhar contato; sem bloqueio, igual ao comportamento de hoje |
| Participante inválido (campo obrigatório faltando) | Validação completa acontece **antes** de qualquer persistência; erro retorna lista `{index, field, message}[]` |
| "Modalidade" esgotada | Não aplicável — conceito não existe no sistema (seção 5) |
| Vagas encerradas (para o tamanho do lote) | Transação com lock rejeita o lote inteiro se `N > vagasDisponiveis`; nenhuma inscrição parcial é criada |
| Alteração de preço durante preenchimento | Preço sempre recalculado no submit, no servidor |
| Alteração do evento durante preenchimento (ex.: camisa desabilitada) | Mesma revalidação total já feita hoje em `create-preference`, repetida por participante |
| Pagamento recusado | Webhook marca `Order.status = PAYMENT_FAILED` e propaga para as N `Registration`s via `updateMany`, atomicamente |
| Pagamento expirado | Mesmo gap que já existe hoje no fluxo individual — não piora, não é resolvido neste RFC |
| Abandono do checkout | `Order` fica `PENDING` indefinidamente; qualquer participante pode sair individualmente (seção 9.6) ou o grupo todo pode retomar via "Continuar pagamento" |
| Webhook duplicado | Guarda de idempotência: `if (order.status === "CONFIRMED") return` antes de qualquer update |
| Webhook atrasado | Sem problema — validação de valor e idempotência independem de ordem de chegada |
| Timeout do gateway ao criar o checkout | `Order` + N `Registration`s já persistidas como `PENDING` antes da chamada ao gateway; usuário pode reusar "Continuar pagamento" para gerar um novo link sem duplicar registros |
| Falha após criação parcial das inscrições | Eliminada pela transação: criação do `Order` + N `Registration`s é tudo ou nada |
| Falha durante o webhook | Confirmação de `Order` + N `Registration`s também dentro de `$transaction` — tudo ou nada; reprocessamento é seguro por ser idempotente |
| Campos dinâmicos obrigatórios | Validados por participante, erros agregados por índice |
| Alteração de configuração do evento durante o processo | Mesma revalidação total no submit já existente hoje |
| **Participante sai de um pedido pendente** | `orderId` removido da sua `Registration`; ela passa a seguir o fluxo individual de checkout; pedido original recalculado (seção 9.6) |
| **Pedido esvaziado (todos os participantes saem)** | `Order.status = CANCELLED`, `paymentId = null` — nenhum "pedido fantasma" fica pagável com total zero |
| **Link de checkout antigo pago após recálculo** | Rejeitado como confirmação automática pela salvaguarda de referência de transação (seção 9.7); fica registrado para reconciliação manual, não é uma falha silenciosa |

---

## 14. Segurança

- **Manipulação de preço**: impossível — todo valor é recalculado no servidor a partir de `event.price`/`shirtConfig`, somado por participante; cliente nunca envia valor.
- **Manipulação da camisa**: `validateShirtSelection` roda por participante, normalizando qualquer seleção inconsistente vinda do cliente (mesma defesa já existente hoje).
- **Manipulação dos participantes**: o array de participantes é validado inteiramente no servidor (contagem, CPF, campos); limite máximo de participantes por lote (`MAX_BATCH_SIZE`, ex.: 10) evita abuso (lote gigante consumindo todas as vagas de uma vez).
- **Fraude via reserva de vagas sem pagamento**: um lote grande em `PENDING` consome N vagas de uma vez (mesmo comportamento do fluxo individual, mas multiplicado). Mitigação recomendada (não bloqueante): job periódico que cancela `Order`s/`Registration`s `PENDING` mais antigas que X horas, liberando vagas.
- **Replay de webhook**: guarda de idempotência em `Order.status === CONFIRMED`, mesmo padrão já usado no InfinitePay individual.
- **Ataques de concorrência**: mitigados pelo lock de leitura de vagas na transação de criação (seção 9.1/9.5) e pelo lock no `Order` durante a operação de saída (seção 9.6) — sem isso, múltiplos lotes/saídas concorrentes podem estourar `maxParticipants` ou corromper o total recalculado.
- **Ausência de HMAC no webhook InfinitePay**: risco preexistente, documentado no próprio código — a segurança depende de `order_nsu` + valor batendo. A salvaguarda de referência de transação (seção 9.7) adiciona uma camada extra específica para o cenário de recálculo, mas não substitui a ausência de HMAC como limitação geral já aceita hoje em produção.
- **Auto-serviço de saída de pedido (`leave-order`)**: só pode ser acionado pelo dono do CPF correspondente àquela `Registration` (mesma superfície de exposição que a busca por CPF já tem hoje — não introduz um novo vetor, já que qualquer pessoa que soubesse o CPF de outra já podia consultar seu status hoje via `search-by-cpf`).

---

## 15. Performance

Cenários avaliados: 2, 5, 10 participantes (**teto revisado de 20 para 10** nesta versão — ver justificativa abaixo).

- **Por que 10 e não 20 nesta revisão**: como o fluxo agora é inline em uma única tela (sem paginação/wizard), o custo de renderizar N cards recolhíveis cresce diretamente com o scroll potencial da tela, mesmo com accordion. Um teto menor (10) mantém a lista de cards gerenciável visualmente em mobile sem depender de nenhuma virtualização de lista. Caso o uso real mostre demanda por lotes maiores, o teto pode subir depois — é um parâmetro de configuração, não uma limitação estrutural.
- **Renderização**: o maior risco é renderizar N cards com até 30 campos dinâmicos cada, todos abertos ao mesmo tempo. Mitigado pelo accordion (1 card expandido por vez) — bound de campos ativos independe de N.
- **Memória**: irrelevante nesses tamanhos em qualquer dispositivo móvel atual.
- **Payload**: JSON de 10 participantes × (campos fixos + até 30 dinâmicos) fica na casa de poucos KB — não é gargalo de rede.
- **Processamento no backend**: validar e persistir até 10 registros dentro de uma transação é uma operação de dezenas de milissegundos — não justifica fila assíncrona.
- **Banco**: uma transação inserindo até ~11 linhas (`Order` + N `Registration`s) é trivial.
- **API**: síncrono, request/response único — não há necessidade de streaming ou polling adicional.

---

## 16. Escalabilidade

- Crescimento da base: `Order` adiciona 1 linha por checkout em lote — overhead desprezível frente ao volume de `Registration`s.
- Milhares de inscrições/pagamentos: nenhuma mudança estrutural no volume esperado; `Registration` continua sendo a tabela de granularidade fina (check-in, relatórios, listagem admin funcionam sem alteração).
- Impacto em funcionalidades futuras: `Order` se torna o ponto de extensão natural para cupom de grupo, nota fiscal consolidada ou relatório financeiro "por pedido", sem necessidade de tocar `Registration` outra vez.

---

## 17. Riscos

| Risco | Severidade | Mitigação |
|---|---|---|
| Ausência de `$transaction`/lock hoje no fluxo de vagas e dedup de CPF — condição preexistente que o lote agrava | **Alta** | Introduzir `$transaction` com lock de leitura nos novos endpoints de lote; idealmente retroaplicar ao fluxo individual |
| Falta de guarda de idempotência no webhook do Mercado Pago (legado) | Média (só se MP voltar a ser ativo) | Fora de escopo deste RFC; documentar que qualquer suporte a lote no MP deve nascer com guarda de idempotência |
| Lote muito grande usado para abuso/DoS | Média | `MAX_BATCH_SIZE` (10) validado no servidor, não só no frontend |
| Abandono de checkout de lote reserva N vagas por tempo indefinido | Média | Job de expiração de `PENDING` antigos (melhoria recomendada) |
| **Link de checkout obsoleto pago após recálculo de um pedido (participante saiu)** | **Média-Alta** — é um risco novo introduzido pela própria funcionalidade de "sair do pedido", não preexistente | Salvaguarda de comparação de referência de transação no webhook (seção 9.7); verificar durante a Fase 6 se a API do InfinitePay permite invalidar/expirar um link ativamente, o que reforçaria essa mitigação |
| **Capacidade do InfinitePay de invalidar um link gerado é desconhecida** | Baixa-Média (incerteza, não confirmado como problema real) | Tratar como questão em aberto a verificar na documentação/API do InfinitePay antes da Fase 6; a salvaguarda da seção 9.7 já cobre o caso mesmo sem essa capacidade |
| Duplicação de lógica de validação entre fluxo individual e de lote se não for extraída para função compartilhada | Baixa (risco de manutenção, não de produção) | Extrair validação por-participante para módulo compartilhado (seção 7.3) |
| Ambiguidade na resolução de `order_nsu` no webhook | Baixa (mitigada por design) | Prefixo determinístico `"ord_"` em vez de fallback sequencial (seção 7.2) |

---

## 18. Estratégia de Migração

1. **Migration aditiva**: criar tabela `orders` + coluna `registrations.order_id` (nullable, FK). Sem backfill. Zero risco para dados existentes.
2. **Backend em rotas novas**: `create-batch-preference`, `create-free-batch`, `leave-order` — não tocam nas rotas existentes.
3. **Webhook estendido, não substituído**: branch adicional por prefixo `"ord_"`; caminho `else` é bit-a-bit o código atual, sem alteração.
4. **Frontend como extensão do modal existente** (checkbox), não um componente paralelo — reduz ainda mais o risco de divergência entre o fluxo individual e o de lote, já que é literalmente o mesmo componente.
5. **Rollout gradual**: pode ser habilitado por evento (flag simples, ex. `Event.allowBatchRegistration: Boolean`) se quiser validar com poucos organizadores antes de expor a todos.

---

## 19. Estratégia de Rollback

Como toda a mudança é aditiva:
- **Rollback de frontend**: ocultar o checkbox "Inscrever mais pessoas" — instantâneo, sem risco, já que o fluxo individual é o mesmo componente com quantidade fixa em 1.
- **Rollback de backend**: desativar as rotas novas (ou a flag por evento) — o webhook continua funcionando normalmente para o fluxo individual (branch `else` nunca muda).
- **Rollback de banco**: não é necessário reverter a migration — tabela `orders` vazia e coluna `orderId` sempre `null` não afetam nenhuma query existente.

---

## 20. Estratégia de Testes

- **Unitários**: soma de `resolveBaseValue` por participante; `validateShirtSelection`/`validateDynamicFormData` chamadas em loop com agregação de erros por índice; detecção de CPF duplicado dentro do próprio array; recálculo de `Order.totalValue` após saída de participante.
- **Integração** (`create-batch-preference`/`create-free-batch`):
  - Happy path com 1, 5 e 10 participantes.
  - Vagas insuficientes para o tamanho do lote (rejeita tudo, nada é persistido).
  - CPF duplicado dentro do lote.
  - CPF já `CONFIRMED` em outra inscrição do mesmo evento.
  - CPF já pertencente a outro `Order` `PENDING`.
  - Evento fora da janela de inscrição / inativo / `DYNAMIC_ONLY` em evento pago.
  - Seleção de camisa inválida para 1 dos N participantes.
- **`leave-order`**:
  - Participante sai de um pedido com 3+ pessoas → total recalculado corretamente, `paymentId` invalidado.
  - Último participante sai → `Order` vai para `CANCELLED`.
  - Tentativa de sair de um pedido já `CONFIRMED` → rejeitada.
  - Duas saídas concorrentes do mesmo pedido → lock garante recálculo consistente (sem total incorreto).
- **Webhook**:
  - Confirmação de `Order` com `order_nsu = "ord_<id>"` propaga `CONFIRMED` para todas as N `Registration`s.
  - Reentrega do mesmo webhook é no-op (idempotência).
  - Valor pago menor que o esperado é rejeitado (422).
  - **Pagamento de um link antigo após recálculo (paymentId divergente) não confirma automaticamente** — fica registrado para reconciliação, não é aplicado silenciosamente.
  - Caminho `else` (individual) segue passando nos testes já existentes, sem regressão.
- **Concorrência**: teste simulando 2 requisições de lote concorrentes disputando a última vaga.
- **E2E manual mobile**: fluxo completo — marcar checkbox, definir quantidade, preencher via accordion, "usar meus dados de contato", escolher camisa por participante no Step 2, total correto, redirecionamento único para checkout, confirmação via webhook real (sandbox InfinitePay), comprovante consolidado, e o fluxo de "sair do pedido" a partir do alerta de CPF.

---

## 21. Conclusão

**⚠️ Recomendo implementar, com ajustes.**

A funcionalidade é tecnicamente viável e se encaixa bem na arquitetura existente. Nesta revisão, a decisão de simplificar a UX (extensão inline do formulário existente, sem wizard) **reduz** o esforço de frontend em relação à v1; em contrapartida, o cenário de pagamento pendente em grupo, analisado a pedido, **aumenta** o escopo de backend com uma operação nova (`leave-order`) e uma salvaguarda de segurança adicional no webhook (referência de transação obsoleta). No agregado, o escopo total é comparável ao da v1 — só redistribuído entre frontend e backend.

Os ajustes que tornam a recomendação condicional continuam sendo:
1. Introduzir `prisma.$transaction` com lock na checagem de vagas — hoje ausente até no fluxo individual.
2. Limitar o tamanho máximo de um lote (`MAX_BATCH_SIZE = 10` nesta revisão).
3. Usar um prefixo determinístico (`"ord_"`) no `order_nsu`.

Mais um, novo desta revisão:

4. Implementar a salvaguarda de referência de transação no webhook (seção 9.7) **junto com** a Fase 6 (saída de pedido) — não depois. Sem essa salvaguarda, a própria funcionalidade de "sair do pedido" introduz um jeito novo de um pagamento ser mal-contabilizado (overpagamento silencioso), que não existia antes dela.

Nenhum desses ajustes é grande o suficiente para inviabilizar a feature.

---

## Plano de Implementação

*Elaborado por a recomendação ser favorável, conforme pedido. Fases pequenas, cada uma revisável e testável isoladamente. Revisado nesta versão para incluir a Fase 6 (sair de pedido pendente) e simplificar a Fase 7 (frontend inline em vez de wizard).*

**Antes de tudo**: `git checkout -b feature/batch-registrations` — nenhum arquivo é alterado antes disso.

### Fase 0 — Schema e migration

- **Objetivo**: adicionar `Order` e `Registration.orderId` sem afetar nada em produção.
- **Descrição**: editar `prisma/schema.prisma` (modelo `Order`, campo `orderId` em `Registration`), rodar `npx prisma db push` (ou gerar migration formal se o projeto usar `prisma migrate` em vez de `db push` — confirmar antes).
- **Dependências**: nenhuma.
- **Arquivos**: `prisma/schema.prisma`.
- **Riscos**: baixíssimo — mudança puramente aditiva.
- **Checklist**: schema atualizado; `prisma generate` rodado; app sobe sem erros com o schema novo.
- **Testes**: `npx prisma studio` para confirmar tabela `orders` criada e coluna `order_id` nullable em `registrations`.
- **Critério de aceite**: build (`npm run build`) passa sem erros de tipo.

### Fase 1 — Módulo de validação compartilhado

- **Objetivo**: extrair a validação por-participante (evento ativo/janela, CPF, camisa, dinâmico, pertencimento a outro pedido pendente) para uma função pura reaproveitável por individual e lote.
- **Descrição**: criar `backend/services/registrationValidation.ts` com uma função `validateParticipant(event, participant, existingRegistrations)`.
- **Dependências**: Fase 0.
- **Arquivos**: novo `backend/services/registrationValidation.ts`.
- **Riscos**: baixo.
- **Checklist**: função testada isoladamente com os mesmos casos já cobertos hoje.
- **Testes**: unitários cobrindo evento inativo, fora da janela, camisa inválida, dinâmico inválido, CPF inválido, CPF em outro pedido pendente.
- **Critério de aceite**: cobertura de teste equivalente à lógica já existente nas rotas atuais.

### Fase 2 — Backend do lote pago

- **Objetivo**: endpoint `POST /api/payments/create-batch-preference` funcional, com transação e lock de vagas.
- **Descrição**: implementar conforme seção 9.1; criar `createInfinitePayCheckoutForOrder`.
- **Dependências**: Fases 0 e 1.
- **Arquivos**: novo `app/api/payments/create-batch-preference/route.ts`; `backend/services/payment/infinitePayService.ts` (função nova).
- **Riscos**: médio — primeira introdução de `$transaction` com lock no projeto.
- **Checklist**: transação atômica confirmada; lock testado sob concorrência.
- **Testes**: integração (happy path N=1/5/10, vagas insuficientes, CPF duplicado intra-lote, CPF já confirmado, CPF em outro pedido); teste de concorrência.
- **Critério de aceite**: todos os cenários da seção 13 relacionados à criação passam.

### Fase 3 — Backend do lote gratuito

- **Objetivo**: endpoint `POST /api/registrations/create-free-batch`.
- **Descrição**: mesmo padrão da Fase 2, sem `Order` (seção 9.2).
- **Dependências**: Fase 1.
- **Arquivos**: novo `app/api/registrations/create-free-batch/route.ts`.
- **Riscos**: baixo.
- **Checklist**: idêntico à Fase 2, adaptado para status `CONFIRMED` direto.
- **Testes**: integração equivalente à Fase 2.
- **Critério de aceite**: N registrations `CONFIRMED` criadas atomicamente, vagas respeitadas.

### Fase 4 — Webhook estendido (com salvaguarda de link obsoleto)

- **Objetivo**: `webhook/infinitepay/route.ts` reconhece `order_nsu` prefixado, confirma o `Order` inteiro e já nasce com a checagem de referência de transação da seção 9.7.
- **Descrição**: implementar conforme seções 9.3 e 9.7 juntas — não adiar a salvaguarda para depois da Fase 6, já que ela é o que torna a Fase 6 segura.
- **Dependências**: Fase 2.
- **Arquivos**: `app/api/payments/webhook/infinitepay/route.ts` (edição, preservando o branch `else` idêntico ao atual).
- **Riscos**: **alto** — é o ponto que, se quebrado, afeta o fluxo individual em produção.
- **Checklist**: testes de regressão do fluxo individual passam sem alteração; idempotência testada; validação de valor testada; salvaguarda de referência de transação testada com um `paymentId` divergente simulado.
- **Testes**: os da seção 20, subseção Webhook.
- **Critério de aceite**: nenhum teste do fluxo individual existente quebra; novos testes de lote e da salvaguarda passam.

### Fase 5 — "Continuar pagamento" para lote

- **Objetivo**: retomar um `Order` `PENDING` gerando novo checkout.
- **Descrição**: conforme seção 9.4, espelhando `update-preference/route.ts`.
- **Dependências**: Fase 4.
- **Arquivos**: novo `app/api/payments/update-batch-preference/route.ts` (ou extensão do existente detectando `orderId` vs `registrationId` no body).
- **Riscos**: baixo.
- **Checklist**: novo link gerado reaproveita mesmo `order_nsu`; `Order.paymentId` atualizado corretamente.
- **Testes**: integração — gerar checkout, simular timeout, retomar, confirmar via webhook.
- **Critério de aceite**: fluxo de retomada funcional ponta a ponta.

### Fase 6 — Sair de um pedido pendente

- **Objetivo**: endpoint `leave-order` funcional, com recálculo e invalidação de link.
- **Descrição**: conforme seção 9.6; **antes de começar, verificar na documentação/API do InfinitePay se é possível invalidar um link de checkout ativamente** (questão em aberto da seção 7.5/17) — se sim, incorporar essa chamada; se não, seguir só com a salvaguarda da Fase 4.
- **Dependências**: Fases 2 e 4 (a salvaguarda do webhook precisa existir antes desta fase ir ao ar).
- **Arquivos**: novo `app/api/registrations/[id]/leave-order/route.ts`; extensão de `ExistingRegistrationAlert.tsx` e de `search-by-cpf/route.ts` (retornar contexto de grupo: demais participantes, total do pedido, valor individual).
- **Riscos**: **alto** — é a fase com mais lógica de negócio nova e mais superfície de concorrência (lock no `Order` durante a saída).
- **Checklist**: recálculo correto testado com 2, 3 e N participantes restantes; caso de pedido esvaziado (`CANCELLED`); teste de concorrência entre saída e confirmação de pagamento simultâneas; histórico de auditoria gravado em `paymentDetails.history[]`.
- **Testes**: os da seção 20, subseção `leave-order`.
- **Critério de aceite**: Maria consegue sair de um pedido abandonado por João e pagar sua própria inscrição, sem afetar Pedro; João e Pedro continuam com um pedido válido e pagável pelo valor correto.

### Fase 7 — Frontend: extensão inline do formulário existente

- **Objetivo**: checkbox "Inscrever mais pessoas" + campo de quantidade + cards recolhíveis, dentro do `EventRegistrationModal.tsx` atual (seção 10).
- **Descrição**: estender o estado do componente existente de "1 participante" para "array de participantes"; Step 2 passa a iterar a escolha de camisa por participante.
- **Dependências**: Fases 2, 3 (endpoints precisam existir para integrar); Fase 6 para o fluxo de saída via `ExistingRegistrationAlert`.
- **Arquivos**: `components/event/EventRegistrationModal.tsx` (extensão, não substituição), `components/registration/ExistingRegistrationAlert.tsx` (nova variante), `components/registration/RegistrationForm.tsx`/`DynamicFormRenderer.tsx` (reaproveitados sem alteração de assinatura).
- **Riscos**: médio — validar que o accordion não degrada a performance percebida com 10 participantes e campos dinâmicos.
- **Checklist**: accordion funcional; "usar meus dados de contato"; validação por card; total reativo no Step 2; touch targets consistentes; alerta de grupo com as duas ações (continuar/sair).
- **Testes**: manual em dispositivo mobile real, cobrindo iOS Safari e o fallback de checkout embutido (Instagram/WebView).
- **Critério de aceite**: fluxo completo testado manualmente ponta a ponta em mobile, incluindo pagamento sandbox, confirmação via webhook real, e o fluxo de saída de pedido.

### Fase 8 — Rollout controlado

- **Objetivo**: habilitar para organizadores/eventos selecionados antes do rollout geral.
- **Descrição**: flag `Event.allowBatchRegistration` (opcional) controlando a exibição do checkbox de lote.
- **Dependências**: todas as fases anteriores (ou Fases 0–5 e 7 apenas, se a Fase 6 for adiada conforme a Opção D da seção 6.3).
- **Arquivos**: `prisma/schema.prisma` (campo opcional), `components/admin/EventModal.tsx` (toggle), ponto de entrada no frontend público.
- **Riscos**: baixo.
- **Checklist**: flag testada ligada/desligada; nenhum evento existente é afetado por padrão (default `false`).
- **Testes**: smoke test com evento real de baixo risco antes de expandir.
- **Critério de aceite**: primeiro evento real usando lote com sucesso, sem incidentes no fluxo individual em paralelo.

---

## Anexo — Registro desta revisão (changelog)

### Alterações incorporadas

1. **UX sem wizard** (item 1 do pedido) — incorporada integralmente. Substitui o wizard dedicado da v1 por checkbox + quantidade + accordion no formulário existente (seções 6.2, 10, 11). Reduz esforço de frontend em relação à v1.
2. **Accordion para participantes** (item 2) — incorporada, já era coerente com a recomendação de UX mobile da v1; formalizada como o único padrão de organização de tela do Step 1 (seção 10.1, 11).
3. **Terminologia "Responsável pela compra"** (item 3) — incorporada, com justificativa técnica adicional de por que esse termo (e não "Responsável pela inscrição") é o mais alinhado à arquitetura `Order` escolhida (seção 7.4).
4. **Step de camisa por participante, ao final** (item 4) — incorporada. Mantém a mesma posição de Step 2 do fluxo atual, iterando por participante; a mesma tela já cumpre o papel de "revisão antes do pagamento", eliminando a etapa de revisão separada que a v1 propunha (seção 10.2).
5. **Cenário de pagamento pendente em grupo** (itens 5 e 6) — incorporado como **Opção C** (oferecer as duas ações ao participante afetado: continuar o grupo ou sair e recalcular), não a Opção B pura como sugerida. Arquitetura completa nas seções 6.3, 7.5, 9.6, 9.7, com nova Fase 6 no plano de implementação.

### Sugestões refinadas em vez de aceitas literalmente (análise crítica)

- **Opção B pura (item 5) foi refinada para Opção C.** Justificativa: a Opção B, sozinha, resolve o problema de Maria mas não oferece alternativa para quem prefere assumir o pagamento do grupo (cenário legítimo e provavelmente comum — combinado previamente entre os participantes). Impor uma única regra de comportamento é pior do que oferecer a escolha, e o custo de engenharia de oferecer as duas é essencialmente zero em cima do mecanismo de saída que precisa existir de qualquer forma.
- **Adicionado um risco não solicitado, mas decorrente diretamente do item 5/6**: pagamento de um link de checkout obsoleto depois que um pedido é recalculado (overpagamento silencioso). Este risco não fazia parte do pedido original, mas é uma consequência direta e não-óbvia de permitir recálculo de um pedido já com link gerado — descrito e mitigado na seção 9.7, com uma questão em aberto explícita (capacidade do InfinitePay de invalidar links) a verificar antes da Fase 6.
- **Teto de participantes por lote reduzido de 20 (v1) para 10 (v2)**, não solicitado explicitamente, mas decorrente da mudança de UX: sem paginação/wizard, um teto menor mantém a tela gerenciável em mobile (seção 15).

### Sugestões descartadas

Nenhuma das sugestões do pedido foi descartada nesta revisão — todas foram avaliadas como tecnicamente adequadas e incorporadas (algumas com refinamento, como descrito acima). A única alternativa explicitamente **não escolhida como principal**, mas mantida documentada como opção de faseamento válida, foi a **Opção D da seção 6.3** (resolução manual via admin, sem self-service de saída) — não por ser tecnicamente inadequada, mas por ser uma experiência inferior à Opção C; fica registrada como redução de escopo aceitável caso o prazo de entrega priorize lançar o lote sem a Fase 6 primeiro.
