# Estratégia de testes

O projeto **não possui suite de testes automatizados** (nenhum runner configurado). Até que isso mude, a validação de cada melhoria segue este protocolo mínimo.

## Verificações obrigatórias em toda melhoria

1. `npm run lint` — sem erros novos.
2. `npm run build` — build de produção passa (inclui `prisma generate`).
3. `npx tsc --noEmit` — checagem de tipos (TypeScript strict).
4. Testes manuais do fluxo alterado, registrados no arquivo da melhoria (seção "Testes realizados") com: cenário, passos, resultado esperado, resultado obtido.

## Ambiente de teste

- Banco local: `docker-compose up -d` (Postgres porta 5433) + `npm run db:push` + `npm run db:seed`.
- Dev server: `npm run dev`.
- Admin padrão criado pelo seed (`prisma/seed.ts`).

## Áreas críticas e seus cenários mínimos

### Pagamentos (reqs. 1, 2, 5, 6, 12)
- Inscrição paga via InfinitePay: criação de preferência, redirecionamento, webhook confirmando, status final `CONFIRMED`.
- Inscrição manual (cada método: PIX, Dinheiro, Cartão) com observação.
- Evento gratuito: fluxo sem cobrança continua funcionando.
- Valor sempre recalculado no servidor — testar tentativa de adulteração de valor no client.
- Webhook InfinitePay: testar com payloads reais/simulados, incluindo `order_nsu` legado (inscrições antigas).

### Autorização (req. 11)
- Cada perfil (Admin, Check-in, Suporte): acessar cada rota de página e de API permitida e **negada**; conferir redirecionamento (`/admin/login` ou acesso negado) e códigos 401/403.
- Tokens antigos (emitidos antes da mudança de roles) continuam válidos ou são tratados.

### Dados legados (todos os reqs. financeiros)
- Telas e relatórios funcionam com inscrições antigas (`paymentMethod: MERCADO_PAGO`, `paymentDetails` em formato legado, sem lote, sem order).

### Mobile/iOS
- Telas novas ou alteradas testadas em viewport mobile (histórico de quirks em `docs/MELHORIAS_IOS_COMPATIBILITY.md`).

## Melhoria futura (a discutir)

Introduzir Vitest + testes de unidade para `backend/utils` (shirtPricing, cálculos financeiros) e para os serviços de pagamento — as áreas onde regressão custa dinheiro. Registrar como proposta quando o núcleo financeiro (fase 2 do roadmap) for iniciado.
