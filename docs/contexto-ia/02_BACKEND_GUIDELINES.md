# 02 — Diretrizes de Backend

Normativo. Define a responsabilidade de cada camada, o que **pode** e o que
**não pode** existir em cada uma. Complementa `01_ARQUITETURA.md`.

## 1. Route Handlers (`app/api/**/route.ts`)

**Responsabilidade única**: adaptar HTTP ↔ Controller.

**Pode:**
- Instanciar/chamar o controller correspondente e retornar sua resposta.
- Extrair `params` de rotas dinâmicas (Next 15: `params` é `Promise` — sempre
  `await`).
- Validação Zod direta **apenas** em rotas triviais sem lógica (ex.: cron/ping).

**Não pode:**
- Conter regra de negócio, queries Prisma diretas, cálculo de valores.
- Montar envelope de resposta manualmente quando existe controller.
- Decodificar JWT (o middleware global já injetou `x-user-*`).

Uma rota saudável tem ~10–20 linhas.

## 2. Controllers (`backend/controllers`)

**Responsabilidade**: orquestrar o caso de uso — validar entrada (Zod),
autorizar (`requireAdmin`/`requireSuperAdmin`), coordenar repositories/services
e montar a resposta com os métodos herdados de `BaseController`.

**Pode:**
- Validar com schemas de `backend/schemas` (nunca schemas locais duplicados).
- Lançar `Error` com mensagens-chave (`"não encontrado"`, `"já existe"`,
  `"acesso negado"`, `"não autorizado"`) e delegar a `handleError`.
- Usar `getPaginationParams` + `paginatedResponse` para listagens.

**Não pode:**
- Acessar `prisma` diretamente — dados passam por repository.
- Retornar formatos fora do envelope `{ success, data | error }`.
- Guardar estado entre requisições.

## 3. Repositories (`backend/repositories`)

**Responsabilidade**: acesso a dados. Estendem `BaseRepository` (CRUD genérico
tipado).

**Pode:**
- Compor queries Prisma, includes, agregações e transações.
- Conter helpers de consulta específicos do domínio (ex.: dedup por CPF+evento).

**Não pode:**
- Validar entrada de usuário, montar respostas HTTP ou conhecer `NextRequest`.
- Ser chamado direto de componentes/páginas (só via controller/service).

**Obrigatório**: toda operação executada no contexto de uma requisição usa
`withPrismaRetry` (ver `01_ARQUITETURA.md` §4.1).

## 4. Services (`backend/services`)

**Responsabilidade**: integrações externas e processos que não são CRUD
(gateways de pagamento, futuras integrações). Exemplo canônico:
`backend/services/payment/infinitePayService.ts` +
`getActiveGateway.ts` (lê `AppSettings`).

**Regras:**
- Segredos só via `process.env`, lidos no servidor. Nunca expor em `NEXT_PUBLIC_*`.
- Toda chamada externa com tratamento de erro explícito e mensagem acionável.
- Conciliação de pagamento sempre por `Registration.id` (`order_nsu`) +
  validação de valor (`paid_amount` ≥ valor recalculado).

## 5. Schemas (`backend/schemas`)

Fonte única de verdade de toda estrutura de dados de entrada **e** dos campos
JSON do banco (`shirtConfig`, `dynamicFormFields`, `fixedFieldsConfig`).

- Um schema por caso de uso, exportado e reutilizado no frontend.
- Mensagens de erro **em português e voltadas ao usuário final** — elas chegam
  à tela via `errors[]`.
- Nunca duplicar schema no frontend; importar de `@/backend/schemas`.

## 6. Utils de domínio (`backend/utils`)

Funções puras e testáveis: `shirtPricing` (recalcular valores — obrigatório em
qualquer cobrança), `paymentFees` (taxas centralizadas), `dynamicFormValidator`
(sanitização server-side), `phone`, `dateUtils`, `bcrypt`, `jwt` (Node).

**Regra**: lógica de negócio repetida em dois lugares → extrair para util aqui.

## 7. Segurança (checklist por rota)

- [ ] A rota está coberta pelo `config.matcher` do middleware? (Rota fora do
      matcher é **pública**. Conferir sempre — inclusive prefixos novos como
      `/api/debug`, `/api/reports`...)
- [ ] Se pública de propósito: está em `publicRoutes` com justificativa e expõe
      o **mínimo** de dados? (Nunca CPF completo, e-mail ou `paymentDetails`
      em rota pública.)
- [ ] Autorização no controller (`requireAdmin`/`requireSuperAdmin`) mesmo com
      middleware — defesa em profundidade.
- [ ] Entrada revalidada com Zod no servidor; JSONs sanitizados antes de
      persistir.
- [ ] Valores monetários recalculados server-side.
- [ ] Dados pessoais (CPF, e-mail, telefone, geo do PageView) tratados como
      sensíveis (LGPD): não logar, não exportar sem necessidade, mascarar onde
      possível.
- [ ] Webhooks: idempotentes (reprocessar a mesma notificação não duplica
      efeito) e validando pertencimento (`order_nsu` → registro real).

## 8. Convenções diversas

- Datas: armazenar UTC; formatar com `dayjs` apenas na borda (UI/relatórios).
- Logs: `console.error` com contexto no controller (`handleError` já loga);
  não logar payloads com dados pessoais.
- Paginação: padrão `page`/`limit` (máx. 100) via `getPaginationParams`.
- Erros de validação: 422 com `errors[]`; erros de regra: 400/404/409 conforme
  mapeamento do `BaseController`.
