import {
  PaymentConfig,
  PaymentMethodConfig,
  CreditCardConfig,
} from "../schemas/eventSchemas";

export type { PaymentConfig };

// Taxas padrão do MercadoPago (baseadas na pesquisa)
const DEFAULT_FEES = {
  pix: 0.0099, // 0,99%
  debit_card: 0.0299, // 2,99%
  credit_card: {
    1: 0.0499, // 4,99%
    2: 0.0599, // 5,99%
    3: 0.0699, // 6,99%
    4: 0.0799, // 7,99%
    5: 0.0899, // 8,99%
    6: 0.0999, // 9,99%
    7: 0.1099, // 10,99%
    8: 0.1199, // 11,99%
    9: 0.1299, // 12,99%
    10: 0.1399, // 13,99%
    11: 0.1499, // 14,99%
    12: 0.1599, // 15,99%
  },
} as const;

export interface PaymentOption {
  method: "pix" | "credit_card" | "debit_card";
  installments?: number;
  enabled: boolean;
  fee_percentage: number;
  base_value: number;
  fee_amount: number;
  final_value: number;
  description: string;
  passthrough_fee: boolean;
}

export interface PaymentCalculation {
  base_value: number;
  available_methods: PaymentOption[];
  default_method?: string;
}

export class PaymentFeeCalculator {
  private static cache = new Map<string, PaymentCalculation>();
  private static cacheTTL = 24 * 60 * 60 * 1000; // 24 horas

  /**
   * Calcula as opções de pagamento disponíveis para um evento
   */
  static calculatePaymentOptions(
    baseValue: number,
    paymentConfig?: PaymentConfig
  ): PaymentCalculation {
    const cacheKey = `${baseValue}_${JSON.stringify(paymentConfig)}`;
    const cachedResult = this.cache.get(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const availableMethods: PaymentOption[] = [];

    // Configuração padrão se não fornecida
    const config = paymentConfig || this.getDefaultPaymentConfig();

    // Verificar se config e config.methods existem
    if (!config || !config.methods) {
      console.error("PaymentFeeCalculator: Invalid payment config", config);
      throw new Error("Configuração de pagamento inválida");
    }

    // PIX
    if (config.methods.pix?.enabled) {
      availableMethods.push(
        this.calculatePixOption(baseValue, config.methods.pix)
      );
    }

    // Cartão de Débito
    if (config.methods.debit_card?.enabled) {
      availableMethods.push(
        this.calculateDebitOption(baseValue, config.methods.debit_card)
      );
    }

    // Cartão de Crédito
    if (config.methods.credit_card?.enabled) {
      for (
        let installments = 1;
        installments <= config.methods.credit_card.max_installments;
        installments++
      ) {
        availableMethods.push(
          this.calculateCreditOption(
            baseValue,
            config.methods.credit_card,
            installments
          )
        );
      }
    }

    const result: PaymentCalculation = {
      base_value: baseValue,
      available_methods: availableMethods,
      default_method: config.default_method,
    };

    // Cache por 24h
    this.cache.set(cacheKey, result);
    setTimeout(() => this.cache.delete(cacheKey), this.cacheTTL);

    return result;
  }

  /**
   * Calcula opção PIX
   */
  private static calculatePixOption(
    baseValue: number,
    config: PaymentMethodConfig
  ): PaymentOption {
    const feePercentage = config.custom_fee || DEFAULT_FEES.pix;
    const feeAmount = config.passthrough_fee ? baseValue * feePercentage : 0;
    const finalValue = baseValue + feeAmount;

    return {
      method: "pix",
      enabled: true,
      fee_percentage: feePercentage,
      base_value: baseValue,
      fee_amount: feeAmount,
      final_value: Math.round(finalValue * 100) / 100,
      description: config.passthrough_fee
        ? `PIX - Aprovação instantânea (+ ${(feePercentage * 100).toFixed(
            2
          )}% taxa)`
        : "PIX - Aprovação instantânea",
      passthrough_fee: config.passthrough_fee,
    };
  }

  /**
   * Calcula opção Cartão de Débito
   */
  private static calculateDebitOption(
    baseValue: number,
    config: PaymentMethodConfig
  ): PaymentOption {
    const feePercentage = config.custom_fee || DEFAULT_FEES.debit_card;
    const feeAmount = config.passthrough_fee ? baseValue * feePercentage : 0;
    const finalValue = baseValue + feeAmount;

    return {
      method: "debit_card",
      enabled: true,
      fee_percentage: feePercentage,
      base_value: baseValue,
      fee_amount: feeAmount,
      final_value: Math.round(finalValue * 100) / 100,
      description: config.passthrough_fee
        ? `Cartão de Débito (+ ${(feePercentage * 100).toFixed(2)}% taxa)`
        : "Cartão de Débito",
      passthrough_fee: config.passthrough_fee,
    };
  }

  /**
   * Calcula opção Cartão de Crédito
   */
  private static calculateCreditOption(
    baseValue: number,
    config: CreditCardConfig,
    installments: number
  ): PaymentOption {
    const feePercentage =
      config.custom_fees?.[installments] ||
      DEFAULT_FEES.credit_card[
        installments as keyof typeof DEFAULT_FEES.credit_card
      ] ||
      DEFAULT_FEES.credit_card[12];
    const feeAmount = config.passthrough_fee ? baseValue * feePercentage : 0;
    const finalValue = baseValue + feeAmount;
    const installmentValue = finalValue / installments;

    const description =
      installments === 1
        ? config.passthrough_fee
          ? `Cartão de Crédito à vista (+ ${(feePercentage * 100).toFixed(
              2
            )}% taxa)`
          : "Cartão de Crédito à vista"
        : config.passthrough_fee
        ? `Cartão de Crédito ${installments}x de R$ ${installmentValue.toFixed(
            2
          )} (+ ${(feePercentage * 100).toFixed(2)}% taxa)`
        : `Cartão de Crédito ${installments}x de R$ ${installmentValue.toFixed(
            2
          )}`;

    return {
      method: "credit_card",
      installments,
      enabled: true,
      fee_percentage: feePercentage,
      base_value: baseValue,
      fee_amount: feeAmount,
      final_value: Math.round(finalValue * 100) / 100,
      description,
      passthrough_fee: config.passthrough_fee,
    };
  }

  /**
   * Configuração padrão de pagamento (todos os métodos habilitados, sem repasse de taxa)
   */
  private static getDefaultPaymentConfig(): PaymentConfig {
    return {
      methods: {
        pix: {
          enabled: true,
          passthrough_fee: false,
        },
        credit_card: {
          enabled: true,
          max_installments: 12,
          passthrough_fee: false,
        },
        debit_card: {
          enabled: true,
          passthrough_fee: false,
        },
      },
      default_method: "pix",
    };
  }

  /**
   * Limpa o cache (para testes ou reset)
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Obtém taxa padrão para um método específico
   */
  static getDefaultFee(
    method: "pix" | "debit_card",
    installments?: number
  ): number {
    if (method === "pix") return DEFAULT_FEES.pix;
    if (method === "debit_card") return DEFAULT_FEES.debit_card;

    // Para credit_card, precisa do número de parcelas
    if (installments && installments >= 1 && installments <= 12) {
      return DEFAULT_FEES.credit_card[
        installments as keyof typeof DEFAULT_FEES.credit_card
      ];
    }

    return DEFAULT_FEES.credit_card[1]; // Fallback para à vista
  }

  /**
   * Valida se uma opção de pagamento é válida para o evento
   */
  static validatePaymentOption(
    method: string,
    installments: number | undefined,
    paymentConfig?: PaymentConfig
  ): boolean {
    const config = paymentConfig || this.getDefaultPaymentConfig();

    // Verificar se config e config.methods existem
    if (!config || !config.methods) {
      console.error(
        "PaymentFeeCalculator: Invalid payment config in validate",
        config
      );
      return false;
    }

    switch (method) {
      case "pix":
        return config.methods.pix?.enabled || false;

      case "debit_card":
        return config.methods.debit_card?.enabled || false;

      case "credit_card":
        return (
          (config.methods.credit_card?.enabled || false) &&
          (installments || 1) <=
            (config.methods.credit_card?.max_installments || 1)
        );

      default:
        return false;
    }
  }
}
