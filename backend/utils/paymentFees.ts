/**
 * Ponto único de verdade sobre taxas de pagamento.
 *
 * O repasse de taxa é configurado NA CONTA InfinitePay e o parcelamento/juros
 * aparecem para o cliente DENTRO do checkout do InfinitePay. Portanto NÃO
 * calculamos taxa do nosso lado — enviamos apenas o valor base. Os valores
 * abaixo são apenas REFERÊNCIA informativa (variam por faixa de faturamento do
 * lojista) e não devem ser usados para cobrança.
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
