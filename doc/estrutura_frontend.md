# 🎨 Estrutura do Frontend - Event-Remir

## 📁 Organização de Pastas

```
/app                    # Next.js App Router
├── (public)/          # Rotas públicas
│   ├── page.tsx       # Página inicial "/"
│   └── layout.tsx     # Layout público
├── admin/             # Rotas administrativas
│   ├── login/
│   │   └── page.tsx   # Página de login
│   ├── dashboard/
│   │   └── page.tsx   # Painel administrativo
│   └── layout.tsx     # Layout admin (com proteção)
├── checkin/           # Sistema de check-in
│   └── page.tsx       # Página de check-in
├── api/               # API Routes (ver estrutura_backend.md)
├── globals.css        # Estilos globais
└── layout.tsx         # Root layout

/components            # Componentes reutilizáveis
├── ui/               # Componentes base UI
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Modal.tsx
│   ├── Card.tsx
│   ├── Loading.tsx
│   └── ErrorBoundary.tsx
├── forms/            # Componentes de formulário
│   ├── EventForm.tsx
│   ├── RegistrationForm.tsx
│   ├── LoginForm.tsx
│   └── SearchForm.tsx
├── layout/           # Componentes de layout
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Sidebar.tsx
│   └── Navigation.tsx
├── event/            # Componentes relacionados a eventos
│   ├── EventCard.tsx
│   ├── EventDetails.tsx
│   └── EventBanner.tsx
├── registration/     # Componentes de inscrição
│   ├── RegistrationModal.tsx
│   ├── RegistrationList.tsx
│   ├── ReceiptModal.tsx
│   └── PaymentButton.tsx
├── admin/            # Componentes admin
│   ├── Dashboard.tsx
│   ├── EventManager.tsx
│   ├── RegistrationManager.tsx
│   ├── FinancialSummary.tsx
│   └── AdminTabs.tsx
└── checkin/          # Componentes de check-in
    ├── CheckinSearch.tsx
    ├── CheckinCard.tsx
    └── CheckinConfirm.tsx

/hooks                # Custom hooks
├── useAuth.ts        # Hook de autenticação
├── useEvent.ts       # Hook para gerenciar eventos
├── useRegistration.ts # Hook para inscrições
├── usePayment.ts     # Hook para pagamentos
├── useUpload.ts      # Hook para upload
└── useLocalStorage.ts # Hook para localStorage

/lib                  # Bibliotecas e configurações
├── auth.ts          # Configuração de autenticação
├── api.ts           # Cliente API (axios/fetch)
├── mercadopago.ts   # Configuração MP frontend
├── prisma.ts        # Cliente Prisma
├── supabase.ts      # Cliente Supabase
└── utils.ts         # Utilitários gerais

/types               # Tipos TypeScript compartilhados
├── api.ts           # Tipos das APIs
├── auth.ts          # Tipos de autenticação
├── event.ts         # Tipos de eventos
├── registration.ts  # Tipos de inscrições
└── index.ts         # Exports centralizados

/styles              # Estilos adicionais
├── components.css   # Estilos específicos de componentes
└── antd-custom.css  # Customizações do Ant Design

/public              # Arquivos estáticos
├── uploads/         # Imagens de eventos
├── images/          # Imagens do sistema
└── icons/           # Ícones personalizados
```

---

## 🏠 Páginas Principais

### app/(public)/page.tsx - Página Inicial

```typescript
// Responsabilidades:
- Verificar se há evento ativo
- Exibir informações do evento ou mensagem "Sem eventos"
- Modal de inscrição
- Modal de comprovante (busca por CPF)
- Layout responsivo mobile-first

// Estado:
- activeEvent: Event | null
- showRegistrationModal: boolean
- showReceiptModal: boolean
- isLoading: boolean

// Componentes Filhos:
- EventCard
- RegistrationModal
- ReceiptModal
- SearchForm
```

### app/admin/login/page.tsx - Login Administrativo

```typescript
// Responsabilidades:
- Formulário de login
- Validação de credenciais
- Redirecionamento após login
- Tratamento de erros

// Estado:
- credentials: { email, password }
- isLoading: boolean
- error: string | null

// Componentes Filhos:
- LoginForm
- ErrorMessage
```

### app/admin/dashboard/page.tsx - Painel Admin

```typescript
// Responsabilidades:
- Sistema de abas (Evento, Inscritos, Financeiro)
- Proteção de rota (auth required)
- Gestão completa do evento
- CRUD de inscrições

// Estado:
- activeTab: 'event' | 'registrations' | 'financial'
- currentEvent: Event | null
- registrations: Registration[]
- financialSummary: FinancialData

// Componentes Filhos:
- AdminTabs
- EventManager
- RegistrationManager
- FinancialSummary
```

### app/checkin/page.tsx - Check-in

```typescript
// Responsabilidades:
- Busca de inscritos
- Confirmação de presença
- Interface simples e rápida
- Feedback visual

// Estado:
- searchTerm: string
- foundRegistration: Registration | null
- isSearching: boolean
- isConfirming: boolean

// Componentes Filhos:
- CheckinSearch
- CheckinCard
- CheckinConfirm
```

---

## 🧩 Componentes UI Base

### components/ui/Button.tsx

```typescript
interface ButtonProps {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "small" | "medium" | "large";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

// Utilizando Ant Design Button como base
// Customização com Tailwind para variants específicas
```

### components/ui/Modal.tsx

```typescript
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  centered?: boolean;
}

// Wrapper do Ant Design Modal
// Responsivo e acessível
```

### components/ui/Input.tsx

```typescript
interface InputProps {
  label?: string;
  placeholder?: string;
  type?: "text" | "email" | "password" | "tel";
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  mask?: string; // Para CPF, telefone, etc.
}

// Wrapper do Ant Design Input
// Validação visual e mensagens de erro
```

---

## 📋 Componentes de Formulário

### components/forms/EventForm.tsx

```typescript
interface EventFormProps {
  initialData?: Event;
  onSubmit: (data: EventData) => Promise<void>;
  isLoading?: boolean;
}

// Responsabilidades:
- Formulário completo de evento
- Upload de banner
- Validação com Zod
- Preview da imagem
- Campos: título, descrição, local, data, preço

// Estado:
- formData: EventData
- bannerFile: File | null
- errors: Record<string, string>
- isUploading: boolean
```

### components/forms/RegistrationForm.tsx

```typescript
interface RegistrationFormProps {
  eventId: string;
  onSuccess: (registration: Registration) => void;
  onCancel: () => void;
}

// Responsabilidades:
- Formulário de inscrição
- Validação em tempo real
- Integração com Mercado Pago
- Campos: nome, email, CPF (opcional)

// Estado:
- formData: RegistrationData
- errors: Record<string, string>
- isSubmitting: boolean
```

### components/forms/LoginForm.tsx

```typescript
interface LoginFormProps {
  onLogin: (credentials: LoginData) => Promise<void>;
  isLoading?: boolean;
  error?: string;
}

// Responsabilidades:
- Formulário de login simples
- Validação básica
- Feedback de erro
- Campos: email, senha

// Estado:
- credentials: LoginData
- showPassword: boolean
```

---

## 🎪 Componentes de Evento

### components/event/EventCard.tsx

```typescript
interface EventCardProps {
  event: Event;
  onRegister: () => void;
  onViewReceipt: () => void;
}

// Responsabilidades:
- Exibição visual do evento
- Banner responsivo
- Informações formatadas (data, local, preço)
- Botões de ação
- Layout mobile-first

// Features:
- Imagem com aspect-ratio otimizado
- Data formatada em português
- Link para Google Maps
- Preço formatado em Real
```

### components/event/EventBanner.tsx

```typescript
interface EventBannerProps {
  src: string;
  alt: string;
  className?: string;
}

// Responsabilidades:
- Exibição otimizada de banner
- Fallback para imagem padrão
- Loading state
- Responsividade

// Features:
- Next.js Image otimizada
- Aspect ratio 1280x640
- object-fit: cover
- Lazy loading
```

---

## 📝 Componentes de Inscrição

### components/registration/RegistrationModal.tsx

```typescript
interface RegistrationModalProps {
  event: Event;
  open: boolean;
  onClose: () => void;
  onSuccess: (registration: Registration) => void;
}

// Responsabilidades:
- Modal de inscrição completo
- Integração com pagamento
- Feedback de sucesso/erro
- Fluxo completo de inscrição

// Estado:
- step: 'form' | 'payment' | 'success'
- registrationData: RegistrationData
- paymentUrl: string | null
```

### components/registration/ReceiptModal.tsx

```typescript
interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
}

// Responsabilidades:
- Busca por CPF/email
- Exibição do comprovante
- Opção de imprimir/baixar PDF
- Tratamento de não encontrado

// Estado:
- searchTerm: string
- registration: Registration | null
- isSearching: boolean
- notFound: boolean
```

### components/registration/PaymentButton.tsx

```typescript
interface PaymentButtonProps {
  eventId: string;
  registrationData: RegistrationData;
  onSuccess: (registration: Registration) => void;
  onError: (error: string) => void;
}

// Responsabilidades:
- Integração com Mercado Pago
- Criação de preferência
- Redirecionamento para checkout
- Verificação de status

// Features:
- Loading states
- Error handling
- Retry mechanism
```

---

## 👨‍💼 Componentes Admin

### components/admin/Dashboard.tsx

```typescript
interface DashboardProps {
  initialTab?: 'event' | 'registrations' | 'financial';
}

// Responsabilidades:
- Container principal do admin
- Sistema de tabs
- Header com logout
- Proteção de acesso

// Estado:
- activeTab: string
- user: AdminUser | null
```

### components/admin/EventManager.tsx

```typescript
interface EventManagerProps {
  event?: Event;
  onEventChange: (event: Event) => void;
}

// Responsabilidades:
- CRUD completo de eventos
- Upload de banner
- Preview do evento
- Validações

// Estado:
- isEditing: boolean
- isCreating: boolean
- isDirty: boolean
```

### components/admin/RegistrationManager.tsx

```typescript
interface RegistrationManagerProps {
  eventId?: string;
}

// Responsabilidades:
- Lista de inscrições
- Cadastro manual
- Filtros e busca
- Exportação (futuro)

// Estado:
- registrations: Registration[]
- filters: RegistrationFilters
- showManualForm: boolean
- pagination: PaginationData
```

---

## 🎣 Custom Hooks

### hooks/useAuth.ts

```typescript
export function useAuth() {
  // Estado:
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Métodos:
  const login = async (credentials: LoginData) => { ... };
  const logout = () => { ... };
  const validateToken = async () => { ... };

  // Return:
  return { user, isLoading, login, logout, isAuthenticated };
}
```

### hooks/useEvent.ts

```typescript
export function useEvent() {
  // Estado:
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Métodos:
  const fetchActiveEvent = async () => { ... };
  const createEvent = async (data: EventData) => { ... };
  const updateEvent = async (id: string, data: EventData) => { ... };

  // Return:
  return { event, isLoading, fetchActiveEvent, createEvent, updateEvent };
}
```

### hooks/useRegistration.ts

```typescript
export function useRegistration() {
  // Estado:
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Métodos:
  const createRegistration = async (data: RegistrationData) => { ... };
  const searchByCpf = async (cpf: string) => { ... };
  const fetchRegistrations = async (eventId: string) => { ... };

  // Return:
  return { registrations, isLoading, createRegistration, searchByCpf };
}
```

### hooks/usePayment.ts

```typescript
export function usePayment() {
  // Estado:
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Métodos:
  const createPreference = async (data: PaymentData) => { ... };
  const checkPaymentStatus = async (id: string) => { ... };

  // Return:
  return { paymentUrl, isProcessing, createPreference, checkPaymentStatus };
}
```

---

## 🎨 Estilização e Design System

### Ant Design Customization

```css
/* styles/antd-custom.css */

/* Cores principais */
:root {
  --primary-color: #1890ff;
  --success-color: #52c41a;
  --warning-color: #faad14;
  --error-color: #f5222d;
}

/* Customização de componentes Ant Design */
.ant-btn-primary {
  @apply bg-blue-600 border-blue-600 hover:bg-blue-700;
}

.ant-modal {
  @apply rounded-lg;
}

/* Responsividade */
@media (max-width: 768px) {
  .ant-modal {
    @apply mx-4;
  }
}
```

### Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      aspectRatio: {
        "event-banner": "2 / 1",
      },
      screens: {
        xs: "475px",
      },
    },
  },
  plugins: [],
};
```

---

## 📱 Responsividade Mobile-First

### Breakpoints Strategy

```css
/* Mobile First Approach */

/* Base styles: Mobile (320px+) */
.event-card {
  @apply p-4 rounded-lg shadow-md;
}

/* Small tablets (640px+) */
@media (min-width: 640px) {
  .event-card {
    @apply p-6;
  }
}

/* Large tablets (768px+) */
@media (min-width: 768px) {
  .event-card {
    @apply p-8 grid grid-cols-2 gap-6;
  }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .event-card {
    @apply max-w-4xl mx-auto;
  }
}
```

### Component Responsiveness Guidelines

```typescript
// Exemplo de componente responsivo
export function EventCard({ event }: EventCardProps) {
  return (
    <div
      className="
      w-full max-w-sm mx-auto
      sm:max-w-md
      md:max-w-2xl md:grid md:grid-cols-2 md:gap-6
      lg:max-w-4xl
    "
    >
      {/* Banner */}
      <div
        className="
        aspect-video w-full
        md:aspect-square
      "
      >
        <EventBanner src={event.bannerUrl} alt={event.title} />
      </div>

      {/* Content */}
      <div
        className="
        p-4 space-y-4
        md:p-0 md:flex md:flex-col md:justify-center
      "
      >
        {/* Event details */}
      </div>
    </div>
  );
}
```

---

## 🔄 Estado Global e Context

### AuthContext.tsx

```typescript
interface AuthContextType {
  user: AdminUser | null;
  login: (credentials: LoginData) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Implementação do provider
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
}
```

### EventContext.tsx (Opcional)

```typescript
interface EventContextType {
  activeEvent: Event | null;
  refreshEvent: () => Promise<void>;
  isLoading: boolean;
}

// Usado para compartilhar estado do evento ativo entre componentes
```

---

## 🧪 Testes e Validação

### Pontos de Teste Frontend:

1. **Componentes UI**: Renderização e props
2. **Formulários**: Validação e submissão
3. **Hooks**: Lógica de estado e efeitos
4. **Navegação**: Rotas e redirecionamentos
5. **Responsividade**: Diferentes breakpoints
6. **Integração**: APIs e pagamentos

### Responsividade Testing:

- Mobile: 320px - 640px
- Tablet: 640px - 1024px
- Desktop: 1024px+

### Acessibilidade:

- Contraste adequado
- Navegação por teclado
- Screen readers
- Focus management
- ARIA labels
