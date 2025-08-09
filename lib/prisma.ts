import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Helper para executar queries com retry em caso de erro de prepared statement
 *
 * Problema: PostgreSQL/Supabase pode perder prepared statements causando erro:
 * "prepared statement does not exist"
 *
 * Solução: Detecta automaticamente o erro, reconecta o Prisma e tenta novamente
 *
 * @param operation - Função que contém as operações do Prisma
 * @param retries - Número máximo de tentativas (padrão: 1)
 * @returns Promise com resultado da operação
 *
 * @example
 * ```typescript
 * // Para operação única
 * const users = await withPrismaRetry(() =>
 *   prisma.user.findMany()
 * );
 *
 * // Para operações em paralelo
 * const [users, count] = await withPrismaRetry(() =>
 *   Promise.all([
 *     prisma.user.findMany(),
 *     prisma.user.count()
 *   ])
 * );
 * ```
 *
 * Documentação completa: doc/SOLUCAO_PREPARED_STATEMENTS.md
 */
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
