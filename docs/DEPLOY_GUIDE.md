# 🚀 Guia de Deploy na Vercel - Event Remir

## 📋 Pré-requisitos

1. **Conta na Vercel**: https://vercel.com
2. **Banco de Dados em Produção**: Supabase (recomendado) ou outro PostgreSQL
3. **Conta Cloudinary**: Para upload de imagens
4. **Conta Mercado Pago**: Para pagamentos reais (opcional)

## 🛠️ Passo a Passo

### 1. Preparação do Banco de Dados

#### Opção A: Supabase (Recomendado - Gratuito)

1. Acesse [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Vá em **Settings > Database**
4. Copie a **Connection String** (URI)
5. Substitua `[YOUR-PASSWORD]` pela senha do seu projeto

#### Opção B: Railway/PlanetScale/Neon

Similar ao Supabase, crie um banco PostgreSQL e obtenha a URL de conexão.

### 2. Deploy via Vercel CLI (Recomendado)

```bash
# 1. Instalar Vercel CLI globalmente
npm install -g vercel

# 2. Fazer login na Vercel
vercel login

# 3. Fazer deploy do projeto (execute na pasta raiz)
vercel

# 4. Configurar variáveis de ambiente
vercel env add DATABASE_URL
vercel env add JWT_SECRET
vercel env add CLOUDINARY_CLOUD_NAME
vercel env add CLOUDINARY_API_KEY
vercel env add CLOUDINARY_API_SECRET
# Adicione outras conforme necessário

# 5. Deploy final
vercel --prod
```

### 3. Deploy via GitHub (Alternativo)

1. **Push para GitHub**:

   ```bash
   git add .
   git commit -m "Preparação para deploy"
   git push origin main
   ```

2. **Conectar na Vercel**:
   - Acesse [vercel.com](https://vercel.com)
   - Clique em "New Project"
   - Importe seu repositório GitHub
   - Vercel detectará automaticamente que é um projeto Next.js

### 4. Configurar Variáveis de Ambiente na Vercel

Na dashboard da Vercel, vá em **Settings > Environment Variables** e adicione:

#### ✅ Obrigatórias

```bash
DATABASE_URL = "postgresql://seu-banco-url-aqui"
JWT_SECRET = "uma-chave-super-secreta-aqui"
```

#### ✅ Para Upload de Imagens

```bash
CLOUDINARY_CLOUD_NAME = "seu-cloud-name"
CLOUDINARY_API_KEY = "sua-api-key"
CLOUDINARY_API_SECRET = "sua-api-secret"
```

#### ✅ Para Admin Padrão

```bash
DEFAULT_ADMIN_EMAIL = "admin@seudominio.com"
DEFAULT_ADMIN_PASSWORD = "senha-segura"
DEFAULT_ADMIN_NAME = "Administrador"
```

#### Para a página de lives (Opcional)

```bash
YOUTUBE_API_KEY = "chave-da-youtube-data-api-v3"   # sem ela, a página usa o embed simples
YOUTUBE_CHANNEL_ID = "UCfLEWtCNEUdQd0D14_SQpCw"   # padrão: @ministerioremir3524
```

#### ⚠️ Para Mercado Pago (Opcional)

```bash
MERCADOPAGO_ACCESS_TOKEN = "seu-token-aqui"
MERCADOPAGO_PUBLIC_KEY = "sua-chave-publica"
```

### 5. Executar Migrations

Após o deploy, você precisa sincronizar o banco:

```bash
# Via CLI da Vercel
vercel env pull .env.local
npx prisma db push

# Ou conectar diretamente no banco e rodar:
npx prisma db push --accept-data-loss
npx prisma db seed
```

### 6. Verificar o Deploy

1. ✅ Site carregando: `https://seu-projeto.vercel.app`
2. ✅ Página admin: `https://seu-projeto.vercel.app/admin`
3. ✅ Login funcionando
4. ✅ Upload de imagens
5. ✅ Criação de eventos

## 🔧 Comandos Úteis

```bash
# Ver logs em tempo real
vercel logs

# Forçar redeploy
vercel --prod --force

# Ver variáveis de ambiente
vercel env ls

# Remover deploy
vercel remove
```

## 🚨 Troubleshooting

### Erro de Banco

- ✅ Verifique se `DATABASE_URL` está correta
- ✅ Confirme se o banco está acessível externamente
- ✅ Execute `npx prisma db push`

### Erro de JWT

- ✅ Gere uma nova chave: `openssl rand -base64 32`
- ✅ Adicione em `JWT_SECRET`

### Erro de Upload

- ✅ Verifique credenciais do Cloudinary
- ✅ Confirme se as variáveis estão no ambiente de produção

### Build Failing

- ✅ Execute `npm run build` localmente primeiro
- ✅ Verifique se não há erros de TypeScript

## 📊 Checklist Final

- [ ] ✅ Banco de dados configurado e acessível
- [ ] ✅ Variáveis de ambiente adicionadas na Vercel
- [ ] ✅ Deploy realizado com sucesso
- [ ] ✅ Migrations executadas
- [ ] ✅ Admin seed criado
- [ ] ✅ Login funcionando
- [ ] ✅ Upload de imagens testado
- [ ] ✅ Criação de evento testada
- [ ] ✅ Inscrição testada
- [ ] ✅ Pagamento mock funcionando

## 🎉 Seu projeto está no ar!

Acesse: `https://seu-projeto.vercel.app`

---

**Dúvidas?** Consulte a [documentação oficial da Vercel](https://vercel.com/docs)
