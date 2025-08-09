# Solução para Erros de Prepared Statements do PostgreSQL/Prisma

## Problema Identificado

Durante o desenvolvimento, identificamos erros 500 nas rotas da API que utilizavam consultas ao banco de dados com Prisma + PostgreSQL (Supabase). O erro específico era:

```
Error [PrismaClientUnknownRequestError]: Invalid `prisma.registration.count()` invocation:

Error occurred during query execution:
ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError {
  code: "26000",
  message: "prepared statement \"s9\" does not exist",
  severity: "ERROR"
})
```

### Contexto do Problema

- **Tecnologias envolvidas**: Next.js 15, Prisma 6.13.0, PostgreSQL (Supabase)
- **Situação**: Queries que funcionavam individualmente falhavam quando executadas em paralelo com `Promise.all()`
- **Causa raiz**: Perda de conexão com prepared statements do PostgreSQL, comum em ambientes serverless ou com conexões instáveis

### Rotas Afetadas

- `/api/registrations` - Listagem de inscrições
- `/api/registrations/stats` - Estatísticas de inscrições

## Solução Implementada

### 1. Função Helper de Retry (`withPrismaRetry`)

Criamos uma função utilitária em `lib/prisma.ts` que detecta automaticamente erros de prepared statement e reconecta o Prisma:

```typescript
// Helper para executar queries com retry em caso de erro de prepared statement
export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  retries: number = 1
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("prepared statement") &&
      retries > 0
    ) {
      console.log("Erro de prepared statement detectado, reconectando...");
      await prisma.$disconnect();
      await prisma.$connect();
      return withPrismaRetry(operation, retries - 1);
    }
    throw error;
  }
}
```

### 2. Implementação nas Rotas

#### Rota de Listagem (`/api/registrations/route.ts`)

```typescript
import { withPrismaRetry } from "@/lib/prisma";

// Antes (com erro):
const [registrations, total] = await Promise.all([
  prisma.registration.findMany({ where, include, orderBy, skip, take }),
  prisma.registration.count({ where }),
]);

// Depois (com solução):
const [registrations, total] = await withPrismaRetry(async () =>
  Promise.all([
    prisma.registration.findMany({ where, include, orderBy, skip, take }),
    prisma.registration.count({ where }),
  ])
);
```

#### Rota de Estatísticas (`/api/registrations/stats/route.ts`)

```typescript
// Contagens com retry
const [totalCount, confirmedCount, pendingCount, cancelledCount] =
  await withPrismaRetry(async () => {
    if (status && status !== "ALL") {
      const count = await prisma.registration.count({ where });
      return [
        count,
        status === "CONFIRMED" ? count : 0,
        status === "PENDING" ? count : 0,
        status === "CANCELLED" ? count : 0,
      ];
    } else {
      return Promise.all([
        prisma.registration.count({ where }),
        prisma.registration.count({ where: { ...where, status: "CONFIRMED" } }),
        prisma.registration.count({ where: { ...where, status: "PENDING" } }),
        prisma.registration.count({ where: { ...where, status: "CANCELLED" } }),
      ]);
    }
  });

// Cálculo de receita com retry
const totalRevenue = await withPrismaRetry(async () => {
  const confirmedRegistrations = await prisma.registration.findMany({
    where: { ...where, status: "CONFIRMED" },
    select: { event: { select: { price: true } } },
  });

  return confirmedRegistrations.reduce(
    (sum, registration) => sum + registration.event.price,
    0
  );
});
```

## Como Aplicar em Outras Rotas

### Passo 1: Importar o Helper

```typescript
import { prisma, withPrismaRetry } from "@/lib/prisma";
```

### Passo 2: Envolver Operações Críticas

Para operações individuais:

```typescript
const result = await withPrismaRetry(async () =>
  prisma.model.findMany({ where: conditions })
);
```

Para operações em paralelo:

```typescript
const [data1, data2] = await withPrismaRetry(async () =>
  Promise.all([prisma.model1.count(), prisma.model2.findMany()])
);
```

### Passo 3: Operações Complexas

Para lógica mais complexa, encapsule tudo na função:

```typescript
const result = await withPrismaRetry(async () => {
  const count = await prisma.model.count({ where });

  if (count > 0) {
    return prisma.model.findMany({ where, take: 10 });
  }

  return [];
});
```

## Casos de Uso Recomendados

### ✅ Use `withPrismaRetry` quando:

- Executar múltiplas queries em paralelo com `Promise.all()`
- Fazer operações de contagem (`count()`) seguidas de consultas
- Trabalhar com agregações complexas
- Operações em rotas de API críticas

### ⚠️ Considere usar quando:

- Queries individuais simples (opcional, mas recomendado para consistência)
- Operações de escrita (`create`, `update`, `delete`)

### ❌ Evite usar quando:

- Operações que já têm tratamento de erro específico
- Transações do Prisma (que têm seu próprio mecanismo de retry)

## Benefícios da Solução

1. **Automatização**: Detecta e resolve automaticamente erros de prepared statement
2. **Transparência**: Não requer mudanças na lógica de negócio
3. **Logging**: Registra quando reconexões acontecem para monitoramento
4. **Configurável**: Permite definir número de tentativas
5. **Type-safe**: Mantém tipagem TypeScript completa

## Monitoramento e Debug

### Logs para Acompanhar

O helper emite logs quando reconexões acontecem:

```
Erro de prepared statement detectado, reconectando...
```

### Métricas Recomendadas

- Frequência de reconexões por rota
- Tempo de resposta antes/depois das correções
- Taxa de sucesso após implementação

## Alternativas Consideradas

1. **Aumentar timeout de conexão**: Não resolve o problema raiz
2. **Pool de conexões**: Complexo para ambiente serverless
3. **Queries individuais**: Impacta performance negativamente
4. **Transações**: Overkill para operações de leitura

## Conclusão

A solução implementada resolve de forma elegante e transparente os problemas de prepared statements do PostgreSQL com Prisma, mantendo performance e confiabilidade das APIs. A função `withPrismaRetry` pode ser aplicada em qualquer rota que precise de operações de banco de dados robustas.

## Arquivos Modificados

- `lib/prisma.ts` - Função helper
- `app/api/registrations/route.ts` - Implementação
- `app/api/registrations/stats/route.ts` - Implementação
- `doc/SOLUCAO_PREPARED_STATEMENTS.md` - Esta documentação

## Próximos Passos

1. Aplicar a solução em outras rotas críticas conforme necessário
2. Monitorar logs para identificar padrões de reconexão
3. Considerar implementação de métricas de performance
4. Avaliar migração para connection pooling se o problema persistir em escala
