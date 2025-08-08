# 🧠 Documento de Instruções para Agente IA - Projeto Next.js: Página de Inscrição de Evento

## 🛩️ Resumo do Projeto

Criar uma aplicação **fullstack com Next.js** (App Router) hospedável na **Vercel**, com foco em **mobile first**. A aplicação será uma página de inscrição para eventos com painel de administração, integração com **Mercado Pago**, e sistema de **check-in**. Utilizar **banco de dados gratuito e compatível com a Vercel**, sendo o **Supabase (PostgreSQL)** com Prisma.

---

## 🔧 Stack Técnica

- **Next.js (App Router)**
- **Prisma** (ORM)
- **Supabase (PostgreSQL)** – versão gratuita compatível com Vercel
- **Ant Design (antd)** – biblioteca de componentes UI escolhida por ser completa, com excelente documentação e fácil manutenção
- **TailwindCSS** (pode ser usado em conjunto para personalizações utilitárias)
- **Mercado Pago SDK** para integração de pagamentos
- **Typescript** (recomendado)
- **Zod** – para validação de dados tanto no frontend quanto no backend com schemas compartilhados

---

## 🏗️ Estrutura do Projeto

```
/app
  /admin
    /login         → Página de login
    /dashboard     → Painel de gestão (inscritos, evento, check-in)
  /checkin         → Tela de check-in
  /               → Página principal do evento ou mensagem "Sem evento"
/backend
  /controllers     → Lógica de negócio
  /services        → Integrações externas (ex: Mercado Pago)
  /repositories    → Acesso aos dados via Prisma
  /middlewares     → Autenticação, validações
  /utils           → Funções auxiliares
  /types           → Tipagens compartilhadas
  /schemas         → Schemas Zod compartilhados com frontend
/lib
/prisma
  schema.prisma    → Definição do banco de dados
/public/uploads    → Imagens do evento
/components        → Componentes reutilizáveis UI (baseado em antd)
/hooks             → Hooks customizados para frontend
/styles            → Estilos globais (se necessário)
```

---

## 📱 Página Inicial - "/"

- Mobile First, responsiva
- Verifica se há evento cadastrado:
  - Se sim: mostrar o layout com as informações abaixo
  - Se não: mensagem “Nenhum evento disponível no momento.”

### 🎯 Informações do Evento

Sugestão de dados necessários:

- **Título do evento**
- **Descrição**
- **Data e hora**
- **Local**
- **Link para localização (Google Maps)**
- **Imagem/Banner do evento** (proporção responsiva: `1280x640`, adaptável com `object-fit` e `aspect-ratio` CSS)
- **Valor da inscrição**

### ✅ Modal de Inscrição

- Nome completo (obrigatório)
- E-mail (obrigatório)
- CPF ou documento (opcional)
- Botão de pagar com Mercado Pago (checkout)
- Validação de dados com **Zod** (utilizando schema compartilhado entre front e back)

#### Após pagamento:

- Redirecionar ou mostrar modal de sucesso
- Salvar inscrição no banco com:
  - Dados do inscrito
  - Tipo de pagamento (via Mercado Pago)
  - Status
  - Data/hora da inscrição
  - ID da transação (MP)

#### 🔁 Controle automático de pagamento via Pix:

- A API do Mercado Pago permite confirmar automaticamente o pagamento Pix usando **webhooks**:
  1. Criar uma **preferência de pagamento Pix**.
  2. Configurar uma rota webhook (ex: `/api/mercadopago/webhook`).
  3. O Mercado Pago envia uma notificação ao seu backend com o ID do pagamento.
  4. O backend consulta o pagamento com esse ID e confirma se o status é `approved`.
  5. Se confirmado, salva a inscrição automaticamente no banco com status "pago" e ID da transação.

### 📜 Modal de Comprovante de Inscrição

- Na interface do evento, disponibilizar campo de busca por CPF e botão: "Ver Comprovante"
- Ao digitar o CPF e clicar:
  - Exibir modal com os dados da inscrição:
    - Nome do inscrito
    - E-mail
    - ID da transação
    - Status do pagamento
    - Data/hora da inscrição
    - Valor pago
    - Nome do evento
  - Botão para fechar modal ou imprimir/baixar comprovante (PDF)

---

## 🔐 Página de Login - "/admin/login"

- Login com e-mail e senha
- Autenticação básica (JWT ou cookie-session simples)
- Protege acesso às rotas de administração

---

## 📊 Painel de Administração - "/admin/dashboard"

### Aba 1 - Dados do Evento

- Formulário para:
  - Título, descrição, local, data/hora, preço, imagem/banner
  - Upload local de imagem (armazenar em `/public/uploads`)
  - Criar/editar evento

### Aba 2 - Lista de Inscritos

- Tabela com:
  - Nome, e-mail, tipo de pagamento, status, data de inscrição
  - Valor pago
  - ID da transação
- Campo para cadastrar inscrição manual:
  - Nome, e-mail, tipo de pagamento, valor
  - Validação com **Zod**

### Aba 3 - Resumo Financeiro

- Valor total arrecadado
- Número total de inscritos

---

## 📲 Página de Check-in - "/checkin"

- Campo de busca por nome, e-mail ou CPF
- Mostrar dados do inscrito + botão "Confirmar presença"
- Atualizar campo `checkin: true` no banco

---

## 🗃️ Banco de Dados - Supabase (PostgreSQL via Prisma)

### Modelo sugerido (Prisma Schema):

```prisma
model Event {
  id          String   @id @default(cuid())
  title       String
  description String
  location    String
  date        DateTime
  price       Float
  bannerUrl   String
  createdAt   DateTime @default(now())
  registrations Registration[]
}

model Registration {
  id             String   @id @default(cuid())
  eventId        String
  event          Event    @relation(fields: [eventId], references: [id])
  name           String
  email          String
  cpf            String?
  paymentStatus  String
  paymentType    String
  amountPaid     Float
  transactionId  String
  checkin        Boolean  @default(false)
  createdAt      DateTime @default(now())
}

model Admin {
  id       String @id @default(cuid())
  email    String @unique
  password String
}
```

---

## 🛠️ Funcionalidades para Implementar

### [ ] Detectar evento ativo na home (`/`)

### [ ] Modal de inscrição com integração Mercado Pago

### [ ] Modal de comprovante de inscrição acessível por busca de CPF

### [ ] Login com autenticação protegida

### [ ] Upload de imagens localmente

### [ ] Painel com abas:

- Cadastro/edição de evento
- Lista e cadastro manual de inscritos
- Visão financeira

### [ ] Check-in com busca e confirmação

### [ ] Validação de formulários com **Zod** (schema único entre front e back)

### [ ] Implementação de webhook para controle automático de pagamento via Pix (status aprovado)

---

## 📦 Dependências a instalar

```bash
npm install next react react-dom tailwindcss prisma @prisma/client mercado-pago antd zod @supabase/supabase-js
```

---

## 🚀 Observações Finais

- Utilizar **Ant Design** como biblioteca principal de UI
- Organizar o back-end no padrão **MVC (Model-View-Controller)** com diretórios separados
- Organizar o front-end com **componentes reutilizáveis** e **boas práticas de composição**
- Utilizar **Zod** para validações com schemas compartilhados entre front e back
- Priorizar acessibilidade e responsividade (mobile first)
- Adicionar proteção de rotas para admin
- Página de erro 404 personalizada
- O projeto precisa estar pronto para deploy na **Vercel**

