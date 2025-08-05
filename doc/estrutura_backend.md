# 🔧 Estrutura do Backend - Event-Remir

## 📁 Organização de Pastas

```
/backend
├── controllers/          # Lógica de negócio das rotas
│   ├── AuthController.ts
│   ├── EventController.ts
│   ├── RegistrationController.ts
│   └── CheckinController.ts
├── services/            # Integrações externas e lógica complexa
│   ├── MercadoPagoService.ts
│   ├── EmailService.ts
│   └── UploadService.ts
├── repositories/        # Acesso aos dados via Prisma
│   ├── BaseRepository.ts
│   ├── EventRepository.ts
│   ├── RegistrationRepository.ts
│   └── AdminRepository.ts
├── middlewares/         # Middlewares de autenticação e validação
│   ├── authMiddleware.ts
│   ├── validationMiddleware.ts
│   └── errorMiddleware.ts
├── utils/              # Funções auxiliares
│   ├── jwt.ts
│   ├── password.ts
│   ├── fileUpload.ts
│   └── dateUtils.ts
├── types/              # Tipagens compartilhadas
│   ├── api.ts
│   ├── auth.ts
│   ├── event.ts
│   └── registration.ts
└── schemas/            # Schemas Zod compartilhados
    ├── authSchemas.ts
    ├── eventSchemas.ts
    ├── registrationSchemas.ts
    └── index.ts
```

---

## 🎯 Controllers (Lógica de Negócio)

### AuthController.ts

```typescript
// Responsabilidades:
- login(req, res): Autenticação de usuário
- logout(req, res): Invalidação de sessão
- validateToken(req, res): Verificação de token JWT
- refreshToken(req, res): Renovação de token (opcional)

// Validações:
- Schema de login (email, password)
- Verificação de credenciais
- Geração de JWT
```

### EventController.ts

```typescript
// Responsabilidades:
- createEvent(req, res): Criar novo evento
- updateEvent(req, res): Atualizar evento existente
- getActiveEvent(req, res): Buscar evento ativo
- deleteEvent(req, res): Remover evento
- uploadBanner(req, res): Upload de banner do evento

// Validações:
- Schema de evento completo
- Validação de datas
- Verificação de arquivo de imagem
- Autorização de admin
```

### RegistrationController.ts

```typescript
// Responsabilidades:
- createRegistration(req, res): Criar inscrição
- getRegistrations(req, res): Listar inscrições (admin)
- getRegistrationByCpf(req, res): Buscar por CPF
- createManualRegistration(req, res): Inscrição manual (admin)
- getFinancialSummary(req, res): Resumo financeiro

// Validações:
- Schema de inscrição
- Verificação de duplicatas
- Validação de CPF (opcional)
- Autorização conforme rota
```

### CheckinController.ts

```typescript
// Responsabilidades:
- searchRegistration(req, res): Buscar inscrito para check-in
- confirmCheckin(req, res): Confirmar presença
- getCheckinStats(req, res): Estatísticas de check-in

// Validações:
- Verificação de inscrição válida
- Validação de status de pagamento
- Prevenção de check-in duplicado
```

---

## 🔧 Services (Integrações Externas)

### MercadoPagoService.ts

```typescript
// Responsabilidades:
- createPaymentPreference(): Criar preferência de pagamento
- getPaymentStatus(): Verificar status do pagamento
- processWebhook(): Processar webhook do MP
- generatePixQR(): Gerar QR Code PIX (se necessário)

// Configurações:
- Access Token do Mercado Pago
- URLs de sucesso e falha
- Webhook URL
- Configuração de produtos/serviços
```

### EmailService.ts (Futuro)

```typescript
// Responsabilidades:
- sendConfirmationEmail(): Email de confirmação
- sendReceiptEmail(): Email de comprovante
- sendReminderEmail(): Email de lembrete

// Configurações:
- SMTP ou serviço de email
- Templates de email
- Configurações de envio
```

### UploadService.ts

```typescript
// Responsabilidades:
- uploadFile(): Upload de arquivos
- deleteFile(): Remoção de arquivos
- validateFile(): Validação de tipo/tamanho
- resizeImage(): Redimensionamento de imagens

// Configurações:
- Diretório de upload (/public/uploads)
- Tipos de arquivo permitidos
- Tamanho máximo
- Dimensões de imagem
```

---

## 🗃️ Repositories (Acesso a Dados)

### BaseRepository.ts

```typescript
// Classe base com métodos comuns:
- findById(id): Buscar por ID
- findAll(): Buscar todos
- create(data): Criar registro
- update(id, data): Atualizar registro
- delete(id): Deletar registro
- count(): Contar registros
```

### EventRepository.ts

```typescript
// Métodos específicos:
- findActiveEvent(): Buscar evento ativo
- findByDateRange(): Buscar por período
- updateBanner(): Atualizar banner
- getEventWithStats(): Evento com estatísticas
```

### RegistrationRepository.ts

```typescript
// Métodos específicos:
- findByCpf(): Buscar por CPF
- findByEmail(): Buscar por email
- findByEventId(): Buscar por evento
- getFinancialSummary(): Resumo financeiro
- updatePaymentStatus(): Atualizar status pagamento
- markCheckin(): Marcar check-in
```

### AdminRepository.ts

```typescript
// Métodos específicos:
- findByEmail(): Buscar admin por email
- validateCredentials(): Validar credenciais
- updatePassword(): Atualizar senha
```

---

## 🛡️ Middlewares

### authMiddleware.ts

```typescript
// Responsabilidades:
- Verificar JWT token
- Extrair dados do usuário
- Proteger rotas admin
- Renovar token (se necessário)

// Comportamento:
- Verificar header Authorization
- Decodificar JWT
- Adicionar user ao req
- Retornar 401 se inválido
```

### validationMiddleware.ts

```typescript
// Responsabilidades:
- Validar req.body com schemas Zod
- Validar req.params
- Validar req.query
- Retornar erros formatados

// Utilização:
- validateBody(schema)
- validateParams(schema)
- validateQuery(schema)
```

### errorMiddleware.ts

```typescript
// Responsabilidades:
- Capturar erros não tratados
- Formatar respostas de erro
- Log de erros
- Ocultar detalhes em produção

// Tipos de erro:
- ValidationError (Zod)
- AuthenticationError
- NotFoundError
- InternalServerError
```

---

## 🔧 Utils (Funções Auxiliares)

### jwt.ts

```typescript
// Funções:
- generateToken(payload): Gerar JWT
- verifyToken(token): Verificar JWT
- decodeToken(token): Decodificar sem verificar
- refreshToken(token): Renovar token
```

### password.ts

```typescript
// Funções:
- hashPassword(password): Criptografar senha
- comparePassword(password, hash): Comparar senha
- generateRandomPassword(): Gerar senha aleatória
```

### fileUpload.ts

```typescript
// Funções:
- saveFile(file, directory): Salvar arquivo
- deleteFile(filepath): Deletar arquivo
- validateImageFile(file): Validar imagem
- generateUniqueFilename(): Nome único
```

### dateUtils.ts

```typescript
// Funções:
- formatDate(date): Formatar data
- isValidEventDate(date): Validar data do evento
- getTimezone(): Obter timezone
- convertToUTC(date): Converter para UTC
```

---

## 📝 Schemas Zod (Validações Compartilhadas)

### authSchemas.ts

```typescript
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const TokenSchema = z.object({
  token: z.string(),
});

export type LoginData = z.infer<typeof LoginSchema>;
```

### eventSchemas.ts

```typescript
export const EventCreateSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(1000),
  location: z.string().min(5).max(200),
  date: z.string().datetime(),
  price: z.number().min(0),
  bannerUrl: z.string().url().optional(),
});

export const EventUpdateSchema = EventCreateSchema.partial();

export type EventData = z.infer<typeof EventCreateSchema>;
```

### registrationSchemas.ts

```typescript
export const RegistrationCreateSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  cpf: z.string().optional(),
  eventId: z.string(),
});

export const RegistrationSearchSchema = z.object({
  cpf: z.string().min(11).max(14),
});

export type RegistrationData = z.infer<typeof RegistrationCreateSchema>;
```

---

## 🚀 APIs Routes (Next.js App Router)

### Estrutura de Rotas

```
/app/api/
├── auth/
│   ├── login/route.ts
│   ├── logout/route.ts
│   └── validate/route.ts
├── events/
│   ├── route.ts              # GET (active), POST (create)
│   ├── [id]/route.ts         # GET, PUT, DELETE
│   └── upload-banner/route.ts
├── registrations/
│   ├── route.ts              # GET (list), POST (create)
│   ├── search/route.ts       # POST (search by CPF)
│   ├── manual/route.ts       # POST (manual registration)
│   └── financial/route.ts    # GET (summary)
├── checkin/
│   ├── search/route.ts       # POST (search)
│   └── confirm/route.ts      # POST (confirm)
└── mercadopago/
    ├── preference/route.ts   # POST (create preference)
    ├── status/route.ts       # GET (payment status)
    └── webhook/route.ts      # POST (webhook)
```

---

## 🔒 Autenticação e Segurança

### JWT Configuration

```typescript
// JWT Secret (env variable)
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=24h

// Token Structure
{
  id: string,
  email: string,
  role: 'admin',
  iat: number,
  exp: number
}
```

### Route Protection

```typescript
// Rotas Públicas:
- GET /api/events (evento ativo)
- POST /api/registrations (inscrição)
- POST /api/registrations/search (busca por CPF)
- POST /api/auth/login
- POST /api/mercadopago/webhook

// Rotas Protegidas (Admin):
- POST /api/events
- PUT /api/events/[id]
- DELETE /api/events/[id]
- GET /api/registrations (lista completa)
- POST /api/registrations/manual
- GET /api/registrations/financial

// Rotas de Check-in (sem auth por simplicidade):
- POST /api/checkin/search
- POST /api/checkin/confirm
```

---

## 📊 Tratamento de Erros

### Error Response Format

```typescript
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR' | 'AUTH_ERROR' | 'NOT_FOUND' | 'INTERNAL_ERROR',
    message: 'Human readable message',
    details?: any // Additional error info
  }
}
```

### Success Response Format

```typescript
{
  success: true,
  data: any,
  meta?: {
    total?: number,
    page?: number,
    limit?: number
  }
}
```

---

## 🧪 Pontos de Teste

### Testes Essenciais:

1. **Autenticação**: Login, logout, proteção de rotas
2. **CRUD Eventos**: Criar, editar, buscar eventos
3. **Inscrições**: Criar inscrição, buscar por CPF
4. **Mercado Pago**: Criar preferência, webhook
5. **Check-in**: Buscar inscrito, confirmar presença
6. **Upload**: Upload de banner, validação de arquivo

### Validações Críticas:

- Schema validation em todas as rotas
- Autenticação em rotas protegidas
- Sanitização de dados de entrada
- Tratamento de erros do banco
- Validação de tipos de arquivo
