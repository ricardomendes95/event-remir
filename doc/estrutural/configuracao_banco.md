# 🗃️ Configuração do Banco de Dados - Event-Remir

## ✅ Status: Configurado e Funcionando

O banco de dados PostgreSQL foi configurado com sucesso usando Docker e está pronto para desenvolvimento.

---

## 🔧 Configuração Atual

### **Banco de Dados**: PostgreSQL 15 (Docker)

- **Host**: localhost
- **Porta**: 5433
- **Database**: eventos_remir
- **Username**: postgres
- **Password**: postgres
- **Connection String**: `postgresql://postgres:postgres@localhost:5433/eventos_remir?schema=public`

### **Container Docker**

- **Nome**: event-remir-postgres-1
- **Status**: ✅ Rodando
- **Health Check**: ✅ Healthy

---

## 📊 Tabelas Criadas

### ✅ `events` (Eventos)

```sql
- id (String, PK)
- title (String)
- description (String)
- location (String)
- date (DateTime)
- price (Float)
- bannerUrl (String, nullable)
- createdAt (DateTime)
- updatedAt (DateTime)
```

### ✅ `registrations` (Inscrições)

```sql
- id (String, PK)
- eventId (String, FK -> events.id)
- name (String)
- email (String)
- cpf (String, nullable)
- paymentStatus (String) -- 'pending', 'approved', 'rejected'
- paymentType (String) -- 'pix', 'credit_card', 'manual'
- amountPaid (Float)
- transactionId (String, nullable)
- checkin (Boolean, default: false)
- checkinAt (DateTime, nullable)
- createdAt (DateTime)
- updatedAt (DateTime)
```

### ✅ `admins` (Administradores)

```sql
- id (String, PK)
- email (String, unique)
- password (String, hashed)
- name (String)
- createdAt (DateTime)
- updatedAt (DateTime)
```

---

## 👤 Usuário Admin Inicial

### ✅ Criado com Sucesso

- **Email**: admin@eventremir.com
- **Senha**: admin123
- **Nome**: Administrador

> ⚠️ **Importante**: Altere a senha após o primeiro login em produção!

---

## 🛠️ Comandos Úteis

### **Gerenciar Container**

```bash
# Iniciar container
docker-compose up -d

# Parar container
docker-compose down

# Ver logs
docker-compose logs postgres

# Status do container
docker ps
```

### **Prisma Commands**

```bash
# Sincronizar schema com banco
npm run db:push

# Executar seed (criar admin)
npm run db:seed

# Reset completo do banco
npm run db:reset

# Abrir Prisma Studio
npx prisma studio
```

### **Acesso Direto ao Banco**

```bash
# Via Docker
docker exec -it event-remir-postgres-1 psql -U postgres -d eventos_remir

# Comandos SQL úteis
\dt              # Listar tabelas
\d events        # Descrever tabela events
SELECT * FROM admins;  # Ver usuários admin
```

---

## 🔄 Scripts Disponíveis

### package.json

```json
{
  "scripts": {
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts",
    "db:reset": "prisma db push --force-reset && npm run db:seed"
  }
}
```

---

## 🚀 Próximos Passos

Agora que o banco está configurado, podemos prosseguir com:

### **FASE 2: Backend - Fundação** (Continuação)

- [ ] **2.4** - Setup de middlewares (auth, validation)
- [ ] **2.5** - Estrutura base dos repositories
- [ ] **2.6** - Controllers base
- [ ] **2.7** - Utilitários e helpers

### **FASE 3: Sistema de Autenticação**

- [ ] **3.1** - Middleware de autenticação JWT
- [ ] **3.2** - API de login (/api/auth/login)
- [ ] **3.3** - Proteção de rotas admin

---

## 🔧 Troubleshooting

### **Problema: Container não inicia**

```bash
# Verificar se porta 5433 está livre
sudo lsof -i :5433

# Remover container e recriar
docker-compose down
docker-compose up -d
```

### **Problema: Conexão recusada**

```bash
# Verificar status do container
docker ps

# Verificar logs
docker-compose logs postgres

# Aguardar health check
docker-compose ps
```

### **Problema: Schema não sincroniza**

```bash
# Limpar cache e regenerar
rm -rf node_modules/.prisma
npx prisma generate
npm run db:push
```

---

## 📁 Arquivos Relacionados

- **docker-compose.yml** - Configuração do container PostgreSQL
- **.env** - Variáveis de ambiente (DATABASE_URL)
- **prisma/schema.prisma** - Schema do banco de dados
- **prisma/seed.ts** - Script de seed (usuário admin)
- **lib/prisma.ts** - Cliente Prisma configurado

---

**✅ Banco configurado e pronto para desenvolvimento!**
