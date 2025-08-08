# 🎉 Event Remir - Sistema de Eventos

_Atualizado em: Agosto 2025_

## 📋 Sobre o Projeto

**Event Remir** é uma aplicação fullstack desenvolvida em Next.js para gestão completa de eventos, incluindo:

- 🏠 **Homepage responsiva** com inscrições
- 👨‍💼 **Painel administrativo** completo
- 💳 **Sistema de pagamento** (Mercado Pago + Mock)
- 📋 **Sistema de comprovantes**
- ✅ **Check-in digital**
- 👥 **Gestão de usuários**

## 🚀 Status do Projeto

**✅ PROJETO COMPLETO - Todas as 9 Fases Implementadas!**

### 📊 Fases Concluídas

- ✅ **FASE 1-6**: Setup, Backend, Auth, Eventos, Homepage, Mercado Pago
- ✅ **FASE 7**: Sistema de Comprovantes
- ✅ **FASE 8**: Painel Administrativo Avançado
- ✅ **FASE 9**: Sistema de Check-in

## 🛠️ Stack Técnica

- **Frontend**: Next.js 15 (App Router), TypeScript, Ant Design, TailwindCSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Banco**: PostgreSQL (Supabase/Docker)
- **Pagamento**: Mercado Pago SDK (com modo mock)
- **Upload**: Cloudinary
- **Autenticação**: JWT + bcryptjs
- **Validação**: Zod

## 🏗️ Arquitetura

```
/app                    # Next.js App Router
├── (routes públicas)   # Homepage, pagamento, check-in
├── admin/              # Painel administrativo
└── api/                # Endpoints backend

/backend               # Lógica de negócio
├── controllers/       # Controllers organizados
├── repositories/      # Acesso aos dados
├── schemas/          # Validações Zod
└── utils/            # Utilitários

/components           # Componentes React
├── admin/           # Componentes administrativos
├── event/           # Componentes de evento
└── registration/    # Componentes de inscrição
```

## 🚀 Como Executar

### Pré-requisitos

- Node.js 18+
- PostgreSQL (Docker recomendado)
- Yarn ou NPM

### Configuração

1. **Clone o repositório**:
```bash
git clone https://github.com/ricardomendes95/event-remir.git
cd event-remir
```

2. **Instale dependências**:
```bash
npm install
```

3. **Configure variáveis de ambiente**:
```bash
cp .env.example .env.local
# Configure suas variáveis (banco, Cloudinary, Mercado Pago)
```

4. **Configure o banco**:
```bash
# Com Docker (recomendado)
docker-compose up -d

# Ou configure PostgreSQL manualmente
```

5. **Execute as migrations**:
```bash
npx prisma migrate dev
npx prisma db seed
```

6. **Inicie o projeto**:
```bash
npm run dev
```

## 📱 Funcionalidades Principais

### 🏠 Homepage
- Exibição de evento ativo
- Modal de inscrição integrado
- Design mobile-first
- Busca de comprovantes por CPF

### 👨‍💼 Painel Admin (`/admin`)
- **Login seguro** com JWT
- **Gestão de Eventos**: CRUD completo, upload de imagens
- **Inscrições**: Lista com filtros, exportação CSV
- **Financeiro**: Relatórios detalhados por método de pagamento
- **Usuários**: CRUD de administradores
- **Check-in**: Controle de presença

### 💳 Sistema de Pagamento
- **Modo Mock**: Ativado para desenvolvimento
- **Mercado Pago**: Integração preparada para produção
- **Comprovantes**: Geração e busca automática
- **Webhooks**: Configurados para atualizações

### 📋 Comprovantes
- **Busca por CPF**: Manual e automática
- **Modal automático**: Exibição pós-pagamento
- **Impressão**: Layout otimizado
- **URL limpa**: Query params removidos automaticamente

## 🔐 Acesso Admin

**Usuário padrão**:
- Email: `admin@eventremir.com`
- Senha: `admin123`

## 📚 Documentação

- `FUNCIONALIDADES_IMPLEMENTADAS.md` - Detalhes de todas as funcionalidades
- `ARQUITETURA.md` - Estrutura técnica detalhada
- `GUIA_DESENVOLVIMENTO.md` - Guias técnicos específicos
- `MOCK_PAYMENT_GUIDE.md` - Guia do sistema de pagamento mock

## 🎯 Próximos Passos

O projeto está **completo e funcional**. Possíveis melhorias futuras:

- Testes automatizados
- Relatórios avançados
- Notificações email/SMS
- App mobile nativo
- Multi-tenancy

## 📞 Suporte

Para dúvidas ou sugestões sobre o projeto, consulte a documentação detalhada nos arquivos mencionados acima.
