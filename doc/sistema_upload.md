# 📷 Sistema de Upload de Imagens

## ✅ **Solução Implementada: Cloudinary**

Após análise das opções disponíveis, foi escolhido o **Cloudinary** por ser:

- ✅ **Compatível com Vercel**: Funciona perfeitamente em ambiente serverless
- ✅ **Gratuito**: Plano free generoso (25 GB de armazenamento)
- ✅ **CDN Global**: Entrega rápida mundial
- ✅ **Otimização Automática**: Redimensiona e comprime automaticamente
- ✅ **Next.js Friendly**: SDK oficial com componentes React

## 🛠️ **Estrutura Implementada**

### **1. Configuração (`/lib/cloudinary.ts`)**

```typescript
// Funções disponíveis:
- uploadImage(file: File): Promise<string>
- deleteImage(imageUrl: string): Promise<void>
- optimizeImageUrl(url: string, options): string
```

### **2. API Route (`/app/api/upload/route.ts`)**

- **Endpoint**: `POST /api/upload`
- **Autenticação**: Bearer token necessário
- **Autorização**: Apenas ADMIN e SUPER_ADMIN
- **Validações**: Tipo de arquivo, tamanho (5MB máx)
- **Resposta**: URL da imagem no Cloudinary

### **3. Hook React (`/hooks/useImageUpload.ts`)**

```typescript
const { uploading, progress, error, url, uploadImage, reset } =
  useImageUpload();
```

### **4. Componente UI (`/components/ImageUpload.tsx`)**

- Upload por drag & drop ou clique
- Preview em tempo real
- Barra de progresso
- Tratamento de erros
- Validação no frontend

## 🔧 **Configuração Necessária**

### **1. Cadastro no Cloudinary**

1. Acesse [cloudinary.com](https://cloudinary.com)
2. Crie uma conta gratuita
3. Anote as credenciais do Dashboard

### **2. Variáveis de Ambiente**

Adicione no `.env.local`:

```env
CLOUDINARY_CLOUD_NAME="seu-cloud-name"
CLOUDINARY_API_KEY="sua-api-key"
CLOUDINARY_API_SECRET="seu-api-secret"
```

## 📝 **Como Usar**

### **1. Em um Formulário**

```tsx
import { ImageUpload } from "@/components/ImageUpload";

function EventForm() {
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  return (
    <form>
      <ImageUpload
        value={bannerUrl}
        onChange={setBannerUrl}
        maxSize={5}
        preview={true}
      />
    </form>
  );
}
```

### **2. Upload Manual**

```tsx
import { useImageUpload } from "@/hooks/useImageUpload";

function CustomUpload() {
  const { uploadImage, uploading, error } = useImageUpload();

  const handleFile = async (file: File) => {
    const url = await uploadImage(file);
    if (url) {
      console.log("Upload sucesso:", url);
    }
  };

  return (
    <input
      type="file"
      onChange={(e) => handleFile(e.target.files[0])}
      disabled={uploading}
    />
  );
}
```

## 🔄 **Fluxo de Upload**

1. **Frontend**: Usuário seleciona arquivo
2. **Validação**: Tipo e tamanho verificados
3. **API**: Autenticação e autorização
4. **Cloudinary**: Upload e processamento
5. **Resposta**: URL otimizada retornada
6. **Banco**: URL salva no campo `bannerUrl` do evento

## 🎯 **Benefícios**

- **Performance**: CDN global e otimização automática
- **Economia**: Não consome espaço no servidor
- **Escalabilidade**: Suporta alto volume sem problemas
- **Manutenção**: Zero configuração de servidor
- **SEO**: URLs otimizadas e carregamento rápido

## 🔗 **URLs Geradas**

Exemplo de URL do Cloudinary:

```
https://res.cloudinary.com/seu-cloud/image/upload/v1234567890/event-remir/events/abc123.webp
```

**URLs Otimizadas** (automáticas):

- Formato WebP para browsers compatíveis
- Compressão inteligente baseada no conteúdo
- Redimensionamento sob demanda
