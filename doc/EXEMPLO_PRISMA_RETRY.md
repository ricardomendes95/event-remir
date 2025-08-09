# Exemplo Prático: Aplicando withPrismaRetry em Novas Rotas

Este arquivo contém exemplos práticos de como aplicar a solução `withPrismaRetry` em diferentes cenários de rotas da API.

## Exemplo 1: Rota de Listagem Simples

```typescript
// app/api/events/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    // ✅ Usando withPrismaRetry para operações em paralelo
    const [events, total] = await withPrismaRetry(async () =>
      Promise.all([
        prisma.event.findMany({
          where: { isActive: true },
          orderBy: { startDate: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.event.count({ where: { isActive: true } }),
      ])
    );

    return NextResponse.json({
      success: true,
      data: {
        items: events,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Erro ao buscar eventos:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
```

## Exemplo 2: Rota de Dashboard com Múltiplas Estatísticas

```typescript
// app/api/admin/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // ✅ Múltiplas contagens em paralelo com retry
    const [
      totalEvents,
      activeEvents,
      totalRegistrations,
      confirmedRegistrations,
      totalRevenue,
    ] = await withPrismaRetry(async () => {
      const [events1, events2, reg1, reg2] = await Promise.all([
        prisma.event.count(),
        prisma.event.count({ where: { isActive: true } }),
        prisma.registration.count(),
        prisma.registration.count({ where: { status: "CONFIRMED" } }),
      ]);

      // Calcular receita total
      const confirmedRegs = await prisma.registration.findMany({
        where: { status: "CONFIRMED" },
        include: { event: { select: { price: true } } },
      });

      const revenue = confirmedRegs.reduce(
        (sum, reg) => sum + reg.event.price,
        0
      );

      return [events1, events2, reg1, reg2, revenue];
    });

    return NextResponse.json({
      success: true,
      data: {
        events: {
          total: totalEvents,
          active: activeEvents,
        },
        registrations: {
          total: totalRegistrations,
          confirmed: confirmedRegistrations,
        },
        revenue: totalRevenue,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar dados do dashboard:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
```

## Exemplo 3: Rota com Operação Condicional

```typescript
// app/api/registrations/report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    // ✅ Operação condicional com retry
    const reportData = await withPrismaRetry(async () => {
      // Primeiro verificar se o evento existe
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, title: true, price: true },
      });

      if (!event) {
        throw new Error("Evento não encontrado");
      }

      // Se existe, buscar dados do relatório
      const [registrations, stats] = await Promise.all([
        prisma.registration.findMany({
          where: { eventId },
          include: {
            event: { select: { title: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.registration.groupBy({
          by: ["status"],
          where: { eventId },
          _count: { status: true },
        }),
      ]);

      return {
        event,
        registrations,
        statistics: stats,
      };
    });

    return NextResponse.json({
      success: true,
      data: reportData,
    });
  } catch (error) {
    console.error("Erro ao gerar relatório:", error);

    if (error.message === "Evento não encontrado") {
      return NextResponse.json(
        { success: false, error: "Evento não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
```

## Exemplo 4: Rota de Criação com Validação

```typescript
// app/api/events/route.ts (POST)
import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, slug, startDate, endDate, maxParticipants, price } = body;

    // ✅ Validação e criação com retry
    const newEvent = await withPrismaRetry(async () => {
      // Verificar se slug já existe
      const existingEvent = await prisma.event.findUnique({
        where: { slug },
      });

      if (existingEvent) {
        throw new Error("Slug já está em uso");
      }

      // Criar o evento
      return prisma.event.create({
        data: {
          title,
          slug,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          maxParticipants,
          price,
          // ... outros campos
        },
      });
    });

    return NextResponse.json({
      success: true,
      data: newEvent,
      message: "Evento criado com sucesso",
    });
  } catch (error) {
    console.error("Erro ao criar evento:", error);

    if (error.message === "Slug já está em uso") {
      return NextResponse.json(
        { success: false, error: "Slug já está em uso" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
```

## Exemplo 5: Rota com Agregações Complexas

```typescript
// app/api/analytics/registrations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // ✅ Agregações complexas com retry
    const analytics = await withPrismaRetry(async () => {
      // Registrações por mês
      const registrationsByMonth = await prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', "createdAt") as month,
          COUNT(*) as count
        FROM registrations 
        WHERE "createdAt" >= NOW() - INTERVAL '6 months'
        GROUP BY month
        ORDER BY month DESC
      `;

      // Registrações por evento
      const registrationsByEvent = await prisma.registration.groupBy({
        by: ["eventId"],
        _count: { id: true },
        _sum: { event: { price: true } }, // Não funciona assim, precisa de join
      });

      // Revenue por evento (método correto)
      const revenueByEvent = await prisma.event.findMany({
        select: {
          id: true,
          title: true,
          price: true,
          _count: {
            registrations: {
              where: { status: "CONFIRMED" },
            },
          },
        },
      });

      return {
        byMonth: registrationsByMonth,
        byEvent: revenueByEvent.map((event) => ({
          eventId: event.id,
          eventTitle: event.title,
          confirmedCount: event._count.registrations,
          revenue: event.price * event._count.registrations,
        })),
      };
    });

    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error("Erro ao buscar analytics:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
```

## Dicas Importantes

### ✅ Boas Práticas

1. **Sempre importe `withPrismaRetry`**:

   ```typescript
   import { prisma, withPrismaRetry } from "@/lib/prisma";
   ```

2. **Use para operações em paralelo**:

   ```typescript
   const [data1, data2] = await withPrismaRetry(async () =>
     Promise.all([query1, query2])
   );
   ```

3. **Encapsule lógica complexa**:
   ```typescript
   const result = await withPrismaRetry(async () => {
     const step1 = await prisma.model.findFirst();
     if (!step1) throw new Error("Not found");
     return prisma.model.create({ data: step1 });
   });
   ```

### ⚠️ Cuidados

1. **Não use para transações do Prisma** (elas já têm retry próprio):

   ```typescript
   // ❌ Não faça isso
   await withPrismaRetry(async () =>
     prisma.$transaction([...])
   );

   // ✅ Faça isso
   await prisma.$transaction([...]);
   ```

2. **Trate erros específicos fora do retry**:

   ```typescript
   try {
     const result = await withPrismaRetry(async () => {
       // operação que pode ter prepared statement error
     });
   } catch (error) {
     // tratar outros tipos de erro
     if (error.message.includes("unique constraint")) {
       // erro de negócio específico
     }
   }
   ```

3. **Monitore os logs** para identificar frequência de reconexões.

## Checklist de Implementação

- [ ] Importar `withPrismaRetry` de `@/lib/prisma`
- [ ] Identificar operações que fazem múltiplas queries
- [ ] Envolver operações com `await withPrismaRetry(async () => ...)`
- [ ] Testar a rota com e sem a solução
- [ ] Verificar logs para confirmar que reconexões funcionam
- [ ] Documentar se necessário

Este padrão garante que suas rotas sejam robustas contra falhas de prepared statements do PostgreSQL/Prisma.
