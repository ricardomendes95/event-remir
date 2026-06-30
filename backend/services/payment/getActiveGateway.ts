import { prisma, withPrismaRetry } from "@/lib/prisma";

export type ActivePaymentGateway = "MERCADO_PAGO" | "INFINITE_PAY";

const SETTINGS_ID = "singleton";

/**
 * Lê o gateway de pagamento ativo nas configurações globais (AppSettings).
 * Default: INFINITE_PAY (caso a linha singleton ainda não exista).
 */
export async function getActivePaymentGateway(): Promise<ActivePaymentGateway> {
  const settings = await withPrismaRetry(() =>
    prisma.appSettings.findUnique({
      where: { id: SETTINGS_ID },
      select: { activePaymentGateway: true },
    })
  );

  return (settings?.activePaymentGateway as ActivePaymentGateway) ?? "INFINITE_PAY";
}

/**
 * Atualiza (ou cria) o gateway ativo nas configurações globais.
 */
export async function setActivePaymentGateway(
  gateway: ActivePaymentGateway
): Promise<ActivePaymentGateway> {
  const settings = await withPrismaRetry(() =>
    prisma.appSettings.upsert({
      where: { id: SETTINGS_ID },
      update: { activePaymentGateway: gateway },
      create: { id: SETTINGS_ID, activePaymentGateway: gateway },
      select: { activePaymentGateway: true },
    })
  );

  return settings.activePaymentGateway as ActivePaymentGateway;
}
