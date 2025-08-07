# Como Obter o Nome do Usuário Logado no AdminHeader

O componente `AdminHeader` foi atualizado para obter automaticamente o nome do usuário logado a partir do token JWT. Aqui estão as opções disponíveis:

## 1. Uso Automático (Recomendado)

O componente agora obtém o nome automaticamente do token JWT:

```tsx
import AdminHeader from "./components/AdminHeader";

// Uso simples - o nome será obtido automaticamente do token
<AdminHeader />;
```

## 2. Hook useAuth Atualizado

O hook `useAuth` foi aprimorado para incluir informações do usuário:

```tsx
import { useAuth } from "../../../hooks/useAuth";

function MeuComponente() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) return <div>Carregando...</div>;
  if (!isAuthenticated) return <div>Não autenticado</div>;

  return (
    <div>
      <h1>Bem-vindo, {user?.name || user?.email}!</h1>
      <p>Email: {user?.email}</p>
      <p>Role: {user?.role}</p>
    </div>
  );
}
```

## 3. API /api/auth/me

Criada uma nova API para buscar dados completos do usuário logado:

```tsx
// GET /api/auth/me
// Headers: Authorization: Bearer <token>

const response = await fetch("/api/auth/me", {
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});

const result = await response.json();
if (result.success) {
  console.log("Usuário:", result.data.user);
}
```

## 4. Fallback com Prop

Caso queira fornecer um nome manualmente (não recomendado):

```tsx
<AdminHeader adminName="João Silva" />
```

## Como Funciona

1. **Token JWT**: O token agora inclui o campo `name` do usuário
2. **Hook useAuth**: Decodifica o token e extrai as informações do usuário
3. **Fallback**: Se não houver nome no token, usa o email (parte antes do @)
4. **API /api/auth/me**: Permite buscar dados atualizados do servidor

## Estrutura do Token JWT

```typescript
{
  id: "user-id",
  email: "usuario@exemplo.com",
  name: "Nome do Usuário",
  role: "ADMIN" | "SUPER_ADMIN",
  iat: 1234567890,
  exp: 1234567890
}
```

## Vantagens da Nova Implementação

- ✅ **Automático**: Nome obtido automaticamente do token
- ✅ **Performático**: Não requer chamadas extras à API
- ✅ **Offline-friendly**: Funciona mesmo sem conexão
- ✅ **Seguro**: Informações vêm do token JWT validado
- ✅ **Fallback**: Sempre mostra algo, mesmo sem nome definido

## Migração de Componentes Existentes

Se você estava passando `adminName` manualmente, pode simplesmente remover:

```tsx
// Antes
<AdminHeader adminName="João Silva" />

// Depois
<AdminHeader />
```

O nome será obtido automaticamente do usuário logado.
