import { MercadoPagoConfig } from "mercadopago";

// Verificar se as variáveis de ambiente existem
const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

if (!accessToken) {
  throw new Error(
    "MERCADO_PAGO_ACCESS_TOKEN não está configurado nas variáveis de ambiente"
  );
}

// Configuração do cliente Mercado Pago
export const mercadoPagoClient = new MercadoPagoConfig({
  accessToken,
  options: {
    timeout: 5000,
    idempotencyKey: "abc",
  },
});

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
