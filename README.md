# 🎪 Event-Remir - Sistema de Inscrições para Eventos

Sistema completo de inscrições para eventos desenvolvido com Next.js, TypeScript, Prisma e Supabase. Inclui integração com Mercado Pago para pagamentos e sistema completo de administração.

## 🚀 Tecnologias

- **Next.js 15** (App Router)
- **TypeScript**
- **Prisma ORM**
- **Supabase (PostgreSQL)**
- **Ant Design**
- **TailwindCSS**
- **Mercado Pago SDK**
- **Zod** (validação)
- **JWT** (autenticação)

# Gerenciar banco

npm run db:push # Sincronizar schema
npm run db:seed # Criar admin
npx prisma studio # Interface visual

# Gerenciar Docker

docker-compose up -d # Iniciar PostgreSQL
docker-compose down # Parar PostgreSQL

# Desenvolvimento

npm run dev # Iniciar Next.js

## 📁 Estrutura do Projeto

```
├── app/                    # Next.js App Router
│   ├── (public)/          # Rotas públicas
│   ├── admin/             # Painel administrativo
│   ├── checkin/           # Sistema de check-in
│   └── api/               # API Routes
├── backend/               # Lógica do backend
│   ├── controllers/       # Controllers
│   ├── services/          # Serviços externos
│   ├── repositories/      # Acesso a dados
│   ├── middlewares/       # Middlewares
│   ├── utils/             # Utilitários
│   ├── types/             # Tipos TypeScript
│   └── schemas/           # Schemas Zod
├── components/            # Componentes React
│   ├── ui/               # Componentes base
│   ├── forms/            # Formulários
│   ├── event/            # Componentes de evento
│   └── admin/            # Componentes admin
├── hooks/                # Custom hooks
├── lib/                  # Configurações
├── prisma/               # Schema do banco
└── doc/                  # Documentação
```

## ⚙️ Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar banco de dados

```bash
# Copiar arquivo de ambiente
cp .env.local.example .env.local

# Configurar DATABASE_URL no .env.local
# Exemplo para Supabase:
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

### 3. Executar migrations

```bash
npx prisma generate
npx prisma db push
```

### 4. Seed do banco (usuário admin)

```bash
npx prisma db seed
```

### 5. Executar o projeto

```bash
npm run dev
```

## 🔧 Variáveis de Ambiente

Crie um arquivo `.env.local` com as seguintes variáveis:

```env
# Database
DATABASE_URL="postgresql://..."

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="24h"

# Mercado Pago
MERCADO_PAGO_ACCESS_TOKEN="your-access-token"
MERCADO_PAGO_PUBLIC_KEY="your-public-key"

# Admin padrão
DEFAULT_ADMIN_EMAIL="admin@example.com"
DEFAULT_ADMIN_PASSWORD="admin123"
DEFAULT_ADMIN_NAME="Administrador"
```

## 📱 Funcionalidades

### Página Principal (`/`)

- ✅ Exibição de evento ativo
- ✅ Modal de inscrição
- ✅ Modal de comprovante (busca por CPF)
- ✅ Layout responsivo mobile-first
- ✅ Integração com Mercado Pago

### Painel Admin (`/admin/dashboard`)

- ✅ Gestão completa de eventos
- ✅ Lista de inscrições
- ✅ Cadastro manual de inscrições
- ✅ Resumo financeiro
- ✅ Upload de banner do evento

### Check-in (`/checkin`)

- ✅ Busca de inscritos
- ✅ Confirmação de presença
- ✅ Interface otimizada para dispositivos móveis

## 🛠️ Desenvolvimento

### Scripts disponíveis

```bash
npm run dev          # Executar em desenvolvimento
npm run build        # Build para produção
npm run start        # Executar build de produção
npm run lint         # Executar ESLint
npm run type-check   # Verificar tipos TypeScript
```

### Estrutura de desenvolvimento

O projeto segue o padrão definido nos documentos:

- [`doc/plano_de_acao.md`](doc/plano_de_acao.md) - Plano de desenvolvimento
- [`doc/estrutura_backend.md`](doc/estrutura_backend.md) - Arquitetura do backend
- [`doc/estrutura_frontend.md`](doc/estrutura_frontend.md) - Arquitetura do frontend

## 🔐 Autenticação

Sistema de autenticação com JWT para proteger rotas administrativas:

- Login: `/admin/login`
- Token válido por 24h (configurável)
- Middleware de proteção automática

## 💳 Pagamentos

Integração completa com Mercado Pago:

- Checkout transparente
- Webhook para confirmação automática
- Suporte a PIX e cartão de crédito
- Controle de status de pagamento

## 📊 Banco de Dados

### Modelos principais:

- **Event**: Eventos
- **Registration**: Inscrições
- **Admin**: Usuários administrativos

### Migrations:

```bash
npx prisma migrate dev     # Aplicar migrations em dev
npx prisma migrate deploy  # Aplicar migrations em prod
npx prisma generate        # Gerar cliente Prisma
```

## 🚀 Deploy na Vercel

1. Conectar repositório à Vercel
2. Configurar variáveis de ambiente
3. Deploy automático

### Variáveis necessárias na Vercel:

- `DATABASE_URL`
- `JWT_SECRET`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_PUBLIC_KEY`

## 📞 Suporte

Para dúvidas ou problemas:

1. Consulte a documentação em [`doc/`](doc/)
2. Verifique os issues no repositório
3. Entre em contato com a equipe de desenvolvimento

---

**Desenvolvido com ❤️ usando Next.js e TypeScript**
