# Taxas do MercadoPago - Referência 2025

**Fonte:** Documentação oficial e valores padrão praticados pelo MercadoPago Brasil

## Taxas por Método de Pagamento

### PIX

- **Taxa:** 0,99%
- **Aprovação:** Imediata
- **Recebimento:** D+0 (imediato) ou D+1 dependendo da configuração

### Cartão de Crédito

- **À vista (1x):** 4,99%
- **2 parcelas:** 5,99%
- **3 parcelas:** 6,99%
- **4 parcelas:** 7,99%
- **5 parcelas:** 8,99%
- **6 parcelas:** 9,99%
- **7 parcelas:** 10,99%
- **8 parcelas:** 11,99%
- **9 parcelas:** 12,99%
- **10 parcelas:** 13,99%
- **11 parcelas:** 14,99%
- **12 parcelas:** 15,99%

**Obs:** Taxas progressivas por parcela são uma estimativa baseada no padrão do mercado. O MercadoPago pode ter taxas fixas ou diferentes.

### Cartão de Débito

- **Taxa:** 2,99%
- **Aprovação:** Imediata
- **Recebimento:** D+1

### Saldo Mercado Pago

- **Taxa:** 0% (sem custo)
- **Aprovação:** Imediata

### Boleto

- **Taxa:** 3,99%
- **Aprovação:** 1-2 dias úteis
- **Recebimento:** D+2 após compensação

## Notas Importantes

1. **Taxas podem variar** conforme volume de transações e negociação
2. **Valores mínimos e máximos** se aplicam conforme política do MP
3. **Recebimento pode ser antecipado** mediante taxa adicional
4. **Taxas sujeitas a alteração** - sempre consultar documentação oficial

## Implementação no Sistema

Estas taxas serão usadas como **padrão fallback** no sistema. O organizador poderá:

- Usar taxas padrão
- Configurar taxas personalizadas
- Escolher se repassa ou absorve as taxas
