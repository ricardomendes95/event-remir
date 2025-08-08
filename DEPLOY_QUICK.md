# 🚀 Deploy Rápido - Event Remir

## Seu projeto está pronto para produção!

✅ **Build funcionando**  
✅ **Todas as funcionalidades implementadas**  
✅ **Configurações de deploy preparadas**

## 📋 Deploy em 5 Minutos

### Passo 1: Banco de Dados (2 min)

1. Acesse [supabase.com](https://supabase.com) e crie conta
2. Clique em "New Project"
3. Escolha nome e senha do banco
4. Aguarde criação (1-2 min)
5. Vá em **Settings > Database**
6. Copie a **Connection String**

### Passo 2: Deploy na Vercel (2 min)

1. Acesse [vercel.com](https://vercel.com)
2. Faça login com GitHub
3. Clique **"New Project"**
4. Selecione o repositório **event-remir**
5. Clique **"Deploy"** (Vercel detecta Next.js automaticamente)

### Passo 3: Configurar Variáveis (1 min)

Na Vercel, vá em **Settings > Environment Variables** e adicione:

**✅ OBRIGATÓRIAS:**

```
DATABASE_URL = sua-url-supabase-aqui
JWT_SECRET = uma-chave-secreta-qualquer
```

**✅ PARA ADMIN PADRÃO:**

```
DEFAULT_ADMIN_EMAIL = admin@eventremir.com
DEFAULT_ADMIN_PASSWORD = admin123
DEFAULT_ADMIN_NAME = Administrador
```

**✅ PARA UPLOAD DE IMAGENS (opcional):**

```
CLOUDINARY_CLOUD_NAME = seu-cloudinary
CLOUDINARY_API_KEY = sua-key
CLOUDINARY_API_SECRET = sua-secret
```

### Passo 4: Inicializar Banco

1. Na Vercel, vá em **Functions > Logs**
2. Ou conecte no banco diretamente e execute:

```sql
-- Suas tabelas serão criadas automaticamente pelo Prisma
```

## 🎉 Pronto!

Seu site estará em: `https://seu-projeto.vercel.app`

### 🔍 Teste Rápido:

1. ✅ Site carregando
2. ✅ Login admin: `/admin/login`
3. ✅ Criar evento
4. ✅ Fazer inscrição

---

## 📞 Problemas?

- **Erro de banco**: Verifique se `DATABASE_URL` está correto
- **Erro de login**: Certifique-se de que `JWT_SECRET` foi adicionado
- **Build failing**: Consulte [/doc/DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)

**Seu projeto está INCRÍVEL! 🎪✨**
