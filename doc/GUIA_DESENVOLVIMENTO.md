# 🛠️ Guia de Desenvolvimento - Event Remir

_Guias técnicos específicos e dicas de desenvolvimento_

## 🔧 Configuração do Ambiente

### 📋 Pré-requisitos

- **Node.js 18+**
- **PostgreSQL** (Docker recomendado)
- **Yarn/NPM**
- **Git**

### 🐳 Setup do Banco com Docker

```bash
# Usando o docker-compose.yml existente
docker-compose up -d

# Verificar se está rodando
docker ps

# Logs do container (se necessário)
docker-compose logs postgres
```

**Configuração do banco**:
- **Host**: localhost
- **Porta**: 5433  
- **Database**: eventos_remir
- **Username/Password**: postgres
- **Connection String**: `postgresql://postgres:postgres@localhost:5433/eventos_remir?schema=public`

### 🔑 Variáveis de Ambiente

```bash
# .env.local
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/eventos_remir?schema=public"
JWT_SECRET="your-super-secret-jwt-key-here"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# Cloudinary (Upload de imagens)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN="your-mp-access-token"
MERCADOPAGO_PUBLIC_KEY="your-mp-public-key"
```

### ⚙️ Comandos Iniciais

```bash
# Instalar dependências
npm install

# Configurar Prisma
npx prisma generate
npx prisma db push

# Popular banco (usuário admin padrão)
npx prisma db seed

# Iniciar desenvolvimento
npm run dev
```

## 🏗️ Padrões de Desenvolvimento

### 📁 Estrutura de Arquivos

**Controllers**:
```typescript
// /backend/controllers/ExampleController.ts
import { BaseController } from './BaseController';

export class ExampleController extends BaseController {
  static async methodName(request: NextRequest) {
    try {
      // Lógica aqui
      return this.success(data);
    } catch (error) {
      return this.error(error.message);
    }
  }
}
```

**Repositories**:
```typescript
// /backend/repositories/ExampleRepository.ts
import { BaseRepository } from './BaseRepository';

export class ExampleRepository extends BaseRepository {
  static async findWithCustomLogic(params: any) {
    return await this.prisma.model.findMany({
      where: { ...params },
      include: { relatedModel: true }
    });
  }
}
```

**API Routes**:
```typescript
// /app/api/example/route.ts
import { ExampleController } from '@/backend/controllers';

export async function GET(request: NextRequest) {
  return await ExampleController.get(request);
}

export async function POST(request: NextRequest) {
  return await ExampleController.create(request);
}
```

### 🎨 Componentes React

**Padrão de Componente**:
```typescript
interface ComponentProps {
  prop1: string;
  prop2?: number;
}

export const Component: React.FC<ComponentProps> = ({
  prop1,
  prop2 = 0
}) => {
  const [state, setState] = useState<StateType>(initialState);
  
  useEffect(() => {
    // Efeitos colaterais
  }, [dependencies]);

  return (
    <div>
      {/* JSX aqui */}
    </div>
  );
};
```

**Hook Personalizado**:
```typescript
export const useCustomHook = (param: string) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Lógica de busca
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, fetchData };
};
```

## 🔐 Sistema de Autenticação

### JWT Edge-Compatible

```typescript
// /lib/jwt-edge.ts
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export const signToken = async (payload: any) => {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(secret);
};

export const verifyToken = async (token: string) => {
  const { payload } = await jwtVerify(token, secret);
  return payload;
};
```

### Middleware de Autenticação

```typescript
// /backend/middlewares/authMiddleware.ts
import { verifyToken } from '@/lib/jwt-edge';

export const authMiddleware = async (request: NextRequest) => {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return Response.json({ error: 'Token não fornecido' }, { status: 401 });
  }

  try {
    const payload = await verifyToken(token);
    return payload;
  } catch {
    return Response.json({ error: 'Token inválido' }, { status: 401 });
  }
};
```

## 📊 Validação com Zod

### Schema Compartilhado

```typescript
// /backend/schemas/exampleSchemas.ts
import { z } from 'zod';

export const createExampleSchema = z.object({
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres'),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  date: z.string().datetime('Data inválida'),
  price: z.number().positive('Preço deve ser positivo'),
});

export type CreateExampleData = z.infer<typeof createExampleSchema>;
```

### Validação no Frontend

```typescript
// Hook de validação
export const useExampleValidation = () => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateFormData = (values: any) => {
    try {
      createExampleSchema.parse(values);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  return { errors, validateFormData, setErrors };
};
```

### Validação no Backend

```typescript
// No controller
import { createExampleSchema } from '@/backend/schemas';

export class ExampleController extends BaseController {
  static async create(request: NextRequest) {
    try {
      const body = await request.json();
      const validatedData = createExampleSchema.parse(body);
      
      // Continuar com lógica...
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.validationError(error.errors);
      }
      return this.error(error.message);
    }
  }
}
```

## 📷 Sistema de Upload (Cloudinary)

### Configuração

```typescript
// /lib/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadImage = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const dataURI = `data:${file.type};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataURI, {
    folder: 'event-remir',
    transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }]
  });

  return result.secure_url;
};
```

### Hook de Upload

```typescript
// /hooks/useImageUpload.ts
export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadImage = async (file: File) => {
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        setUrl(data.url);
        setProgress(100);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Erro no upload da imagem');
    } finally {
      setUploading(false);
    }
  };

  return { uploading, progress, url, error, uploadImage };
};
```

## 💳 Sistema de Pagamento Mock

### Como Funciona

O sistema possui **dois modos**:

1. **Modo Mock** (desenvolvimento) - Ativo por padrão
2. **Modo Produção** (Mercado Pago real)

### Configuração Mock

```typescript
// /components/MercadoPagoCheckout.tsx
const MOCK_MODE = true; // Alterar para false em produção

const handleMockPayment = () => {
  // Simula aprovação automática
  setTimeout(() => {
    router.push('/payment/success?registration_id=' + registrationData.id);
  }, 2000);
};
```

### Fluxo Mock

1. **Usuário clica "Pagar"** → Simula processamento (2s)
2. **Redirect automático** → `/payment/success`
3. **Webhook simulado** → Atualiza status para CONFIRMED
4. **Modal automático** → Exibe comprovante

### Preparação para Produção

```typescript
// Para ativar Mercado Pago real:
const MOCK_MODE = false;

// Configurar variáveis:
MERCADOPAGO_ACCESS_TOKEN="PROD_ACCESS_TOKEN"
MERCADOPAGO_PUBLIC_KEY="PROD_PUBLIC_KEY"

// Webhook URL para produção:
// https://seudominio.com/api/payments/webhook
```

## 🔍 Debug e Troubleshooting

### Logs Úteis

```typescript
// No desenvolvimento, adicione logs:
console.log('[DEBUG] Dados recebidos:', data);
console.log('[ERROR] Erro capturado:', error);

// Para banco de dados:
console.log('[DB] Query executada:', query);
console.log('[DB] Resultado:', result);
```

### Problemas Comuns

1. **Erro de CORS**: Verificar `middleware.ts`
2. **JWT não funciona**: Verificar `JWT_SECRET` no .env
3. **Banco não conecta**: Verificar se Docker está rodando
4. **Upload falha**: Verificar credenciais Cloudinary
5. **Build falha**: Verificar imports e tipos TypeScript

### Comandos de Debug

```bash
# Verificar banco
npx prisma studio

# Reset do banco
npx prisma migrate reset
npx prisma db seed

# Verificar portas em uso
lsof -i :3000
lsof -i :5433

# Limpar cache Next.js
rm -rf .next
npm run dev
```

## 🚀 Deploy na Vercel

### Preparação

```bash
# Build local para testar
npm run build

# Verificar se tudo está funcionando
npm start
```

### Configurações Vercel

**Environment Variables**:
- `DATABASE_URL` → Supabase/Neon connection string
- `JWT_SECRET` → String segura
- `CLOUDINARY_*` → Credenciais de produção  
- `MERCADOPAGO_*` → Tokens de produção

**Build Settings**:
- Framework: Next.js
- Node.js Version: 18.x
- Build Command: `npm run build`
- Output Directory: `.next`

### Edge Runtime

APIs preparadas para **Edge Runtime** da Vercel:
```typescript
export const runtime = 'edge';
```

Funciona para APIs leves. Para operações pesadas, usar **Node.js runtime**.

## 📝 Melhores Práticas

### Código

- **TypeScript strict mode** sempre ativado
- **Componentes funcionais** com hooks
- **Props sempre tipadas**
- **Errors tratados** adequadamente
- **Loading states** em operações async

### Performance

- **Lazy loading** para componentes grandes
- **Memoização** com useMemo/useCallback
- **Otimização de imagens** via Cloudinary
- **Paginação** em listas grandes

### Segurança

- **Validação** em frontend E backend
- **Sanitização** de inputs
- **JWT com expiração** adequada
- **Permissões** baseadas em roles
- **Environment variables** nunca commitadas

### Manutenibilidade

- **Documentação** sempre atualizada
- **Comentários** em lógicas complexas
- **Estrutura** organizada e consistente
- **Testes** (a implementar futuramente)
- **Code review** antes de merge
