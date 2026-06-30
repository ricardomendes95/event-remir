/**
 * Ponto único de verdade sobre taxas de pagamento.
 *
 * Evita duplicação de valores espalhados pelo código. Há dois modelos distintos:
 *
 * - **InfinitePay (gateway ativo)**: o repasse de taxa é configurado NA CONTA
 *   InfinitePay e o parcelamento/juros aparecem para o cliente DENTRO do checkout
 *   do InfinitePay. Portanto NÃO calculamos taxa do nosso lado — enviamos apenas
 *   o valor base. Os valores abaixo são apenas REFERÊNCIA informativa (variam por
 *   faixa de faturamento do lojista) e não devem ser usados para cobrança.
 *
 * - **Mercado Pago (legado, fora do fluxo ativo)**: mantido no repositório para
 *   eventual reativação. As taxas vivem aqui para não duplicar.
 */

// ---------------------------------------------------------------------------
// InfinitePay — Checkout / Link de Pagamento
// ---------------------------------------------------------------------------

export const INFINITEPAY = {
  /** O checkout online aceita Pix e crédito (NÃO aceita débito). */
  supportsDebit: false,
  /** Pix é gratuito (0%) no InfinitePay. */
  pixFree: true,
  /** Máximo de parcelas no crédito. */
  maxInstallments: 12,
  /**
   * Taxas de REFERÊNCIA do Link de Pagamento (faixa de faturamento inicial,
   * até ~R$20 mil/mês). Apenas informativas — a cobrança real e o repasse são
   * resolvidos pelo próprio checkout do InfinitePay conforme a conta do lojista.
   */
  referenceFees: {
    pix: 0, // grátis
    credit_1x: 0.042, // 4,20%
    // crédito parcelado cresce ~de 6% (2x) a ~18% (12x) conforme a faixa
    credit_min_parcelado: 0.0609,
    credit_max_parcelado: 0.1829,
  },
} as const;

/** Texto curto para exibir ao participante antes do checkout. */
export const INFINITEPAY_PAYMENT_HINT =
  "No próximo passo você paga com Pix (na hora) ou cartão de crédito em até 12x.";

// ---------------------------------------------------------------------------
// Mercado Pago — LEGADO (mantido fora do fluxo ativo)
// ---------------------------------------------------------------------------

/** Taxas padrão do Mercado Pago. Usadas apenas pelo PaymentFeeCalculator (legado). */
export const MERCADO_PAGO_FEES = {
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
