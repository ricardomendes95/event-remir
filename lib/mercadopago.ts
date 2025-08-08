import { MercadoPagoConfig } from "mercadopago";

// Verificar se as variáveis de ambiente existem
const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

// Durante o build, não validar as variáveis (permite deploy sem Mercado Pago)
const isBuildTime =
  process.env.NODE_ENV === "production" && !process.env.VERCEL_ENV;

if (!accessToken && !isBuildTime) {
  console.warn(
    "⚠️ MERCADO_PAGO_ACCESS_TOKEN não configurado - sistema funcionará em modo mock"
  );
}

// Configuração do cliente Mercado Pago (só se token existir)
export const mercadoPagoClient = accessToken
  ? new MercadoPagoConfig({
      accessToken,
      options: {
        timeout: 5000,
        idempotencyKey: "abc",
      },
    })
  : null;

// Configurações públicas para o frontend
export const mercadoPagoConfig = {
  publicKey: process.env.MERCADO_PAGO_PUBLIC_KEY,
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
  webhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET,
};

// Validar configuração
export function validateMercadoPagoConfig() {
  const requiredVars = ["MERCADO_PAGO_ACCESS_TOKEN", "MERCADO_PAGO_PUBLIC_KEY"];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Variáveis de ambiente do Mercado Pago não configuradas: ${missingVars.join(
        ", "
      )}`
    );
  }

  return true;
}
