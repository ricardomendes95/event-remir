# Validação Integrada do Formulário de Eventos

## Objetivo

Implementar validação do formulário usando o mesmo schema do backend, garantindo consistência entre frontend e backend e exibindo erros específicos da API nos campos do formulário.

## Arquivos Criados/Modificados

### 🆕 `/hooks/useEventValidation.ts`

**Finalidade**: Hook personalizado para validação de eventos usando o schema do backend

**Funcionalidades**:

- Schema de validação idêntico ao backend (`EventCreateSchema`)
- Validação local antes do envio
- Processamento de erros da API
- Gestão de estados de erro por campo
- Funções para limpar erros

**Principais funções**:

- `validateFormData(values)`: Valida dados localmente
- `setApiErrors(apiErrors)`: Define erros vindos da API
- `clearErrors()`: Limpa todos os erros
- `getFieldError(fieldName)`: Obtém erro de um campo específico

### 🆕 `/utils/slugUtils.ts`

**Finalidade**: Utilitários para geração e validação de slugs

**Funcionalidades**:

- `generateSlug(text)`: Converte texto em slug URL-amigável
- `isValidSlug(slug)`: Valida formato do slug
- Remove acentos, caracteres especiais
- Converte para minúsculas e substitui espaços por hífens

### ✅ `/components/admin/EventModal.tsx`

**Melhorias implementadas**:

#### 1. **Validação Integrada**

```tsx
const { validateFormData, setApiErrors, clearErrors, getFieldError } =
  useEventValidation();
```

#### 2. **Validação Local + API**

```tsx
// Validação local primeiro
const validation = validateFormData(values);
if (!validation.isValid) {
  message.error("Por favor, corrija os erros no formulário");
  return;
}

// Se houver erros da API, exibir nos campos
if (result.errors && Array.isArray(result.errors)) {
  setApiErrors(result.errors);
  message.error("Corrija os erros indicados nos campos");
}
```

#### 3. **Campos com Validação Aprimorada**

- **Título**: 3-100 caracteres
- **Descrição**: 10-1000 caracteres
- **Slug**: 3-100 caracteres, formato URL-amigável
- **Local**: 5-200 caracteres
- **Datas**: Validação de formato e lógica de negócio
- **Valores numéricos**: Validação de range e formato

#### 4. **Geração Automática de Slug**

```tsx
const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const title = e.target.value;
  if (!editingEvent && !form.getFieldValue("slug")) {
    form.setFieldValue("slug", generateSlug(title));
  }
};
```

#### 5. **Exibição de Erros**

Cada campo agora mostra:

```tsx
validateStatus={getFieldError("fieldName") ? "error" : ""}
help={getFieldError("fieldName")}
```

## Validações Implementadas

### Regras do Schema (idênticas ao backend)

- **Título**: 3-100 caracteres
- **Descrição**: 10-1000 caracteres
- **Slug**: 3-100 caracteres, apenas a-z, 0-9 e hífens
- **Local**: 5-200 caracteres
- **Datas**: Formato ISO válido
- **Participantes**: Mínimo 1
- **Preço**: Maior ou igual a 0
- **Banner**: URL válida (opcional)

### Validações de Lógica de Negócio

- Data de início < Data de fim
- Data início inscrições < Data fim inscrições
- Inscrições encerram antes/no início do evento

## Fluxo de Validação

1. **Validação em Tempo Real**: Regras do Antd Form
2. **Validação Pré-Envio**: Schema local usando Zod
3. **Validação do Backend**: Resposta da API com erros específicos
4. **Exibição de Erros**: Erros da API mostrados nos campos correspondentes

## Exemplo de Resposta de Erro da API

```json
{
  "success": false,
  "error": "Dados inválidos",
  "errors": [
    {
      "field": "description",
      "message": "Descrição deve ter pelo menos 10 caracteres"
    },
    {
      "field": "slug",
      "message": "Já existe um evento com este slug"
    }
  ]
}
```

## Benefícios

✅ **Consistência**: Mesmas regras no front e backend  
✅ **UX Melhorada**: Erros específicos nos campos  
✅ **Validação Dupla**: Local + servidor  
✅ **Feedback Imediato**: Validação em tempo real  
✅ **Automação**: Geração automática de slug  
✅ **Manutenibilidade**: Validação centralizada em hook

## Status

✅ Implementação concluída  
✅ Testes funcionais OK  
✅ Integração frontend-backend OK  
✅ Validação em tempo real funcionando  
✅ Geração automática de slug ativa
