// Dicionário para tradução dos métodos de pagamento
export const PAYMENT_METHODS_DICTIONARY = {
  pix: "PIX",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
} as const;

// Função para obter o nome em português do método de pagamento
export const getPaymentMethodName = (method: string): string => {
  return (
    PAYMENT_METHODS_DICTIONARY[
      method as keyof typeof PAYMENT_METHODS_DICTIONARY
    ] || method
  );
};

// Função para obter todos os métodos disponíveis
export const getAvailablePaymentMethods = () => {
  return Object.keys(PAYMENT_METHODS_DICTIONARY);
};

// Função para verificar se um método é válido
export const isValidPaymentMethod = (method: string): boolean => {
  return method in PAYMENT_METHODS_DICTIONARY;
};
