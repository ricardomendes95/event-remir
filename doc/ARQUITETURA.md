# 🏗️ Arquitetura do Projeto - Event Remir

_Documentação técnica da estrutura e organização do projeto_

## 📁 Estrutura Geral do Projeto

```
event-remir/
├── app/                    # Next.js App Router
├── backend/               # Lógica de negócio organizada
├── components/            # Componentes React reutilizáveis
├── hooks/                 # Custom hooks
├── lib/                   # Configurações de bibliotecas
├── prisma/                # Schema e migrations do banco
├── public/                # Assets estáticos
├── types/                 # Definições de tipos TypeScript
├── utils/                 # Utilitários compartilhados
└── doc/                   # Documentação do projeto
```

## 🎯 Next.js App Router (Frontend)

### Estrutura de Rotas

```
/app
├── layout.tsx             # Layout raiz da aplicação
├── page.tsx              # Homepage principal "/"
├── globals.css           # Estilos globais
├── admin/                # Rotas administrativas protegidas
│   ├── layout.tsx        # Layout admin com autenticação
│   ├── page.tsx          # Dashboard principal "/admin"
│   ├── events/           # Gestão de eventos
│   │   └── page.tsx      # "/admin/events"
│   ├── registrations/    # Gestão de inscrições
│   │   └── page.tsx      # "/admin/registrations"
│   ├── financial/        # Relatórios financeiros
│   │   └── page.tsx      # "/admin/financial"
│   ├── users/           # Gestão de usuários
│   │   └── page.tsx      # "/admin/users"
│   ├── login/           # Login administrativo
│   │   └── page.tsx      # "/admin/login"
│   └── access-denied/    # Acesso negado
│       └── page.tsx      # "/admin/access-denied"
├── checkin/              # Sistema de check-in
│   └── page.tsx          # "/checkin"
├── payment/              # Páginas de resultado do pagamento
│   ├── success/          # Pagamento aprovado
│   │   └── page.tsx      # "/payment/success"
│   ├── failure/          # Pagamento rejeitado
│   │   └── page.tsx      # "/payment/failure"
│   └── pending/          # Pagamento pendente
│       └── page.tsx      # "/payment/pending"
└── api/                  # Next.js API Routes (Backend)
    ├── admin/            # Endpoints administrativos
    │   ├── events/       # CRUD de eventos
    │   ├── registrations/ # Gestão de inscrições
    │   ├── financial/    # Relatórios financeiros
    │   └── users/        # CRUD de usuários
    ├── auth/             # Autenticação e autorização
    │   ├── login/        # Login de usuários
    │   └── me/           # Dados do usuário logado
    ├── checkin/          # Endpoints de check-in
    ├── events/           # Eventos públicos
    ├── image-proxy/      # Proxy para imagens
    ├── payments/         # Integração Mercado Pago
    │   ├── create/       # Criação de pagamento
    │   ├── webhook/      # Webhook Mercado Pago
    │   └── status/       # Status do pagamento
    ├── registrations/    # Inscrições públicas
    │   ├── create/       # Criar inscrição
    │   ├── search-by-cpf/ # Buscar por CPF
    │   └── get-by-id/    # Buscar por ID
    └── upload/           # Upload de arquivos
```

## 🔧 Backend Architecture

### Organização da Lógica de Negócio

```
/backend
├── controllers/          # Controllers organizados por domínio
│   ├── BaseController.ts # Controller base com métodos comuns
│   ├── EventController.ts # Lógica de eventos
│   ├── UserController.ts  # Lógica de usuários
│   └── index.ts          # Exportações centralizadas
├── repositories/         # Camada de acesso aos dados
│   ├── BaseRepository.ts # Repository base com métodos comuns
│   ├── EventRepository.ts # Acesso aos dados de eventos
│   ├── RegistrationRepository.ts # Acesso aos dados de inscrições
│   ├── AdminRepository.ts # Acesso aos dados de admin
│   └── index.ts          # Exportações centralizadas
├── schemas/              # Validações Zod compartilhadas
│   ├── authSchemas.ts    # Schemas de autenticação
│   ├── eventSchemas.ts   # Schemas de eventos
│   ├── registrationSchemas.ts # Schemas de inscrições
│   ├── userSchemas.ts    # Schemas de usuários
│   └── index.ts          # Exportações centralizadas
├── middlewares/          # Middlewares de aplicação
│   ├── authMiddleware.ts # Autenticação JWT
│   ├── errorMiddleware.ts # Tratamento de erros
│   ├── validationMiddleware.ts # Validação de dados
├── types/                # Definições de tipos do backend
│   ├── api.ts            # Tipos de API
│   ├── auth.ts           # Tipos de autenticação
│   ├── event.ts          # Tipos de eventos
│   ├── registration.ts   # Tipos de inscrições
│   └── index.ts          # Exportações centralizadas
└── utils/                # Utilitários do backend
    ├── bcrypt.ts         # Utilitários de criptografia
    ├── dateUtils.ts      # Utilitários de data
    ├── jwt.ts            # Utilitários JWT
    └── password.ts       # Utilitários de senha
```

### Padrão de Arquitetura

**Controller → Repository → Prisma → Database**

1. **Controllers**: Recebem requests, validam dados, orchestram a lógica
2. **Repositories**: Abstração do acesso aos dados, queries especializadas
3. **Prisma**: ORM para interação type-safe com o banco
4. **Database**: PostgreSQL com schema bem definido

### Padrões Obrigatórios para APIs

#### 🔄 Tratamento de Database Queries

**SEMPRE use `withPrismaRetry`** para operações do Prisma nas APIs:

```typescript
// ✅ CORRETO - Pattern padrão para novas APIs
import { prisma, withPrismaRetry } from "@/lib/prisma";

const [data, count] = await withPrismaRetry(async () =>
  Promise.all([prisma.model.findMany({ where }), prisma.model.count({ where })])
);
```

**Justificativa**: Resolve automaticamente erros de prepared statements do PostgreSQL/Supabase que podem causar falhas 500 nas APIs.

**Documentação**: Ver `doc/SOLUCAO_PREPARED_STATEMENTS.md` e `doc/EXEMPLO_PRISMA_RETRY.md`

#### 📝 Estrutura de Resposta da API

**Padrão de Response**:

```typescript
// Sucesso
return NextResponse.json({
  success: true,
  data: resultado,
  message: "Mensagem opcional",
});

// Erro
return NextResponse.json(
  {
    success: false,
    error: "Mensagem de erro",
  },
  { status: codigoStatus }
);
```

#### 🛡️ Middleware de Autenticação

**Rotas protegidas** são automaticamente validadas pelo middleware em `/middleware.ts`:

- `/admin/*` - Requer role ADMIN ou SUPER_ADMIN
- `/api/admin/*` - APIs administrativas
- `/api/registrations/*` - APIs de gestão de inscrições
- `/checkin/*` - Sistema de check-in

## 🎨 Frontend Components

### Organização dos Componentes

```
/components
├── admin/                # Componentes administrativos
│   ├── AdminHeader.tsx   # Cabeçalho do admin
│   ├── ChangePasswordModal.tsx # Modal de alteração de senha
│   ├── EventModal.tsx    # Modal de eventos
│   ├── FinancialDashboard.tsx # Dashboard financeiro
│   ├── RegistrationModal.tsx # Modal de inscrições
│   ├── UserManagement.tsx # Gestão de usuários
│   ├── UserModal.tsx     # Modal de usuários
│   └── index.ts          # Exportações centralizadas
├── event/                # Componentes de eventos
│   └── EventDisplay.tsx  # Exibição de evento na homepage
├── registration/         # Componentes de inscrição
│   ├── EventRegistrationModal.tsx # Modal de inscrição
│   └── RegistrationList.tsx # Lista de inscrições
├── AutoShowProofModal.tsx # Modal automático de comprovante
├── ImageUpload.tsx       # Componente de upload de imagens
├── MercadoPagoCheckout.tsx # Checkout Mercado Pago
├── PaymentResultPage.tsx # Página de resultado de pagamento
├── RegistrationProofModal.tsx # Modal de comprovante
└── SearchComprovante.tsx # Busca de comprovante na homepage
```

### Padrões de Componentes

- **Componentes Funcionais** com hooks
- **Props tipadas** com TypeScript
- **Estado local** com useState/useReducer
- **Efeitos colaterais** com useEffect
- **Validação** integrada com schemas Zod

## 🪝 Custom Hooks

```
/hooks
├── useAuth.ts            # Autenticação e estado do usuário
├── useCpfVerification.ts # Verificação e formatação de CPF
├── useEventValidation.ts # Validação de eventos
├── useImageUpload.ts     # Upload de imagens
└── useUsers.ts           # Gestão de usuários
```

## 📚 Bibliotecas e Configurações

```
/lib
├── cloudinary.ts         # Configuração do Cloudinary
├── jwt-edge.ts          # JWT compatível com Edge Runtime
├── mercadopago.ts       # Configuração do Mercado Pago
└── prisma.ts            # Cliente Prisma configurado
```

## 🗄️ Database Schema (Prisma)

### Principais Modelos

```prisma
model Event {
  id            String          @id @default(cuid())
  title         String
  description   String
  date          DateTime
  location      String
  price         Decimal
  maxParticipants Int?
  bannerUrl     String?
  isActive      Boolean         @default(false)
  slug          String          @unique
  registrations Registration[]
}

model Registration {
  id           String   @id @default(cuid())
  name         String
  email        String
  cpf          String
  phone        String
  status       RegistrationStatus @default(PENDING)
  paymentId    String?
  checkInAt    DateTime?
  createdAt    DateTime @default(now())
  event        Event    @relation(fields: [eventId], references: [id])
  eventId      String
}

model Admin {
  id          String    @id @default(cuid())
  name        String
  email       String    @unique
  password    String
  role        AdminRole @default(ADMIN)
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
}
```

## 🔄 Fluxo de Dados

### Fluxo de Inscrição

1. **Homepage** → Modal de inscrição aberto
2. **Validação** → Dados validados com Zod
3. **API Call** → `/api/registrations/create`
4. **Controller** → `RegistrationController.create()`
5. **Repository** → `RegistrationRepository.create()`
6. **Prisma** → Salva no PostgreSQL
7. **Response** → Retorna dados da inscrição
8. **Redirect** → Página de pagamento

### Fluxo de Pagamento Mock

1. **Checkout** → `MercadoPagoCheckout` component
2. **Mock Payment** → Simula aprovação automática
3. **Webhook** → `/api/payments/webhook` (simulado)
4. **Update Status** → Atualiza status para CONFIRMED
5. **Redirect** → `/payment/success`
6. **Auto Modal** → Modal de comprovante automático

### Fluxo Administrativo

1. **Login** → `/admin/login` com JWT
2. **Middleware** → Verificação de token
3. **Dashboard** → Carregamento dos dados
4. **CRUD Operations** → Controllers específicos
5. **Real-time Updates** → Estado reativo com hooks

## ⚡ Performance e Otimizações

### Frontend

- **Lazy Loading** de componentes
- **Memoização** com useMemo/useCallback
- **Otimização de imagens** via Cloudinary
- **Bundle splitting** automático do Next.js

### Backend

- **Connection pooling** do Prisma
- **Query optimization** nos repositories
- **Edge Runtime** para APIs leves
- **Caching** de dados estáticos

### Database

- **Índices** em campos de busca
- **Relações** otimizadas
- **Paginação** em todas as consultas
- **Prepared statement retry** com `withPrismaRetry` helper
- **Soft deletes** onde apropriado

## 🔐 Segurança

### Autenticação

- **JWT tokens** com expiração
- **Password hashing** com bcrypt
- **Role-based access control**
- **Middleware** de proteção de rotas

### Validação

- **Input validation** com Zod
- **Type safety** com TypeScript
- **CORS** configurado adequadamente
- **Rate limiting** (preparado)

## 🚀 Deploy e DevOps

### Preparação para Produção

- **Vercel** como plataforma target
- **Edge functions** compatíveis
- **Environment variables** configuradas
- **Database** pronto para Supabase/Neon

### Configurações

- **Next.js config** otimizado
- **PostCSS** para TailwindCSS
- **ESLint** configurado
- **TypeScript** strict mode

## 📋 Diretrizes para Novos Desenvolvedores

### ✅ Checklist Obrigatório para Novas APIs

Ao criar uma nova rota da API (`/app/api/*/route.ts`):

1. **Import Pattern**:

   ```typescript
   import { NextRequest, NextResponse } from "next/server";
   import { prisma, withPrismaRetry } from "@/lib/prisma";
   ```

2. **Database Operations**:

   ```typescript
   // ✅ SEMPRE use withPrismaRetry
   const result = await withPrismaRetry(async () => prisma.model.operation());
   ```

3. **Response Pattern**:

   ```typescript
   return NextResponse.json({
     success: true,
     data: result,
   });
   ```

4. **Error Handling**:
   ```typescript
   catch (error) {
     console.error("Erro detalhado:", error);
     return NextResponse.json(
       { success: false, error: "Mensagem amigável" },
       { status: 500 }
     );
   }
   ```

### 🎯 Para Implementar Nova Funcionalidade

1. **Consultar Documentação**:

   - `doc/SOLUCAO_PREPARED_STATEMENTS.md` - Padrões de DB
   - `doc/EXEMPLO_PRISMA_RETRY.md` - Exemplos práticos
   - `doc/FUNCIONALIDADES_IMPLEMENTADAS.md` - Features existentes

2. **Seguir Estrutura**:

   - Controller em `/backend/controllers/`
   - Repository em `/backend/repositories/`
   - Schema Zod em `/backend/schemas/`
   - API Route em `/app/api/*/route.ts`

3. **Testar Sempre**:
   - Operações individuais do Prisma
   - Operações em paralelo (`Promise.all`)
   - Cenários de erro (prepared statements)
   - Validação de dados com Zod

### 🚨 Problemas Comuns e Soluções

| Problema                     | Sintoma                               | Solução                           |
| ---------------------------- | ------------------------------------- | --------------------------------- |
| **Prepared Statement Error** | `"prepared statement does not exist"` | Use `withPrismaRetry`             |
| **Token Inválido**           | 401 em rotas protegidas               | Verificar middleware e cookies    |
| **Validação Falhando**       | Dados não passam pelo Zod             | Verificar schema e tipos          |
| **CORS Error**               | Bloqueio do navegador                 | Verificar configuração do Next.js |

### 📚 Referências Rápidas

- **Padrão de API**: `/app/api/registrations/route.ts`
- **Padrão de Controller**: `/backend/controllers/EventController.ts`
- **Padrão de Repository**: `/backend/repositories/EventRepository.ts`
- **Padrão de Schema**: `/backend/schemas/eventSchemas.ts`
- **Padrão de Hook**: `/hooks/useAuth.ts`

---

**💡 Dica**: Sempre consulte a documentação antes de implementar. Os padrões existentes foram testados e otimizados para evitar problemas comuns.
