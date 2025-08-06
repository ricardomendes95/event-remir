# 🎭 Sistema de Pagamento Mockado - Event Remir

## Status Atual

O sistema está configurado em **MODO MOCKADO** para permitir testes locais sem dependências externas do Mercado Pago.

## Como Funciona (Modo Mockado)

### 1. Fluxo de Inscrição

- Usuário preenche o formulário de inscrição
- Sistema **simula** o pagamento automaticamente
- Inscrição é criada diretamente como **CONFIRMADA**
- Usuário é redirecionado para página de sucesso

### 2. Arquivos Modificados

- `app/api/payments/create-preference/route.ts` - **MOCKADO**
- `app/api/payments/create-preference/route.real.ts` - **BACKUP ORIGINAL**
- `components/EventRegistrationModal.tsx` - **ADAPTADO PARA MOCK**

### 3. Características do Mock

- ✅ Todas as validações de negócio mantidas
- ✅ Verificação de vagas disponíveis
- ✅ Verificação de período de inscrições
- ✅ Prevenção de inscrições duplicadas
- ✅ Criação automática de registro confirmado
- ✅ Redirecionamento para página de sucesso

## Para Testar o Sistema

### 1. Iniciar o servidor

```bash
npm run dev
```

### 2. Acessar a aplicação

- Ir para `http://localhost:3001`
- Escolher um evento ativo
- Clicar em "Inscrever-se"
- Preencher o formulário
- **Sistema simulará pagamento automaticamente**

### 3. Verificar inscrição

- Inscrição será criada com status `CONFIRMED`
- Usuário será redirecionado para `/payment/success`
- Logs no console mostrarão detalhes da simulação

## Para Voltar ao Mercado Pago Real

### 1. Restaurar arquivos originais

```bash
# Voltar para versão real
mv app/api/payments/create-preference/route.ts app/api/payments/create-preference/route.mock.ts
mv app/api/payments/create-preference/route.real.ts app/api/payments/create-preference/route.ts
```

### 2. Restaurar modal original

```bash
# Reverter alterações no modal
git checkout components/EventRegistrationModal.tsx
```

### 3. Configurar variáveis de ambiente

```env
# .env.local
MERCADOPAGO_ACCESS_TOKEN=seu_token_aqui
MERCADOPAGO_PUBLIC_KEY=sua_chave_publica_aqui
NEXTAUTH_URL=https://seu-dominio.com
```

### 4. Testar em ambiente de produção

- Deploy no Vercel/Netlify/Railway
- Configurar webhook público
- Testar com cartões de teste do Mercado Pago

## Logs e Debug

### Console do Servidor

```
🔄 MODO MOCKADO: Simulando pagamento...
✅ MOCKADO: Inscrição criada com sucesso: clx1234567890
```

### Console do Cliente

```javascript
🎭 Inscrição mockada: {
  registrationId: "clx1234567890",
  participantName: "João Silva",
  eventTitle: "Workshop Next.js",
  status: "CONFIRMED",
  message: "🎭 Pagamento simulado com sucesso!"
}
```

## Próximos Passos

### ✅ Concluído

- [x] Fase 4: Gestão de eventos completa
- [x] Fase 5: Homepage e exibição de eventos
- [x] Fase 6: Integração Mercado Pago (técnica)
- [x] Mockamento para testes locais

### 🚀 Pendente para Deploy

- [ ] Configurar hospedagem (Vercel recomendado)
- [ ] Configurar variáveis de ambiente de produção
- [ ] Ativar integração real do Mercado Pago
- [ ] Testar webhook em produção
- [ ] Configurar domínio personalizado

## Estrutura de Diretórios

```
app/
├── api/
│   └── payments/
│       ├── create-preference/
│       │   ├── route.ts (MOCKADO)
│       │   └── route.real.ts (BACKUP)
│       └── webhook/
│           └── route.ts (REAL - para produção)
└── payment/
    ├── success/
    ├── failure/
    └── pending/

components/
├── EventRegistrationModal.tsx (ADAPTADO)
└── PaymentResultPage.tsx (REAL)
```

## Comandos Úteis

```bash
# Ver logs em tempo real
npm run dev

# Verificar inscrições no banco
npx prisma studio

# Reset do banco de dados
npx prisma db push --force-reset

# Ver estrutura atual
ls -la app/api/payments/create-preference/
```

---

**⚠️ IMPORTANTE**: Lembre-se de voltar para a versão real antes do deploy em produção!
