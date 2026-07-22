# Requisito de Melhoria: Sistema de Métodos de Pagamento com Taxas

**Data de Criação:** 10/08/2025  
**Versão:** 1.0  
**Responsável:** Ricardo Mendes  
**Status:** Em Desenvolvimento - FASE 4

## 1. RESUMO EXECUTIVO

Implementar um sistema completo de gestão de métodos de pagamento no cadastro de eventos, permitindo que organizadores configurem quais métodos aceitar, número máximo de parcelas e se desejam repassar as taxas do MercadoPago para os participantes. O sistema deve usar dados reais de taxas do MercadoPago para garantir que não haja prejuízo financeiro.

## 2. JUSTIFICATIVA

- **Problema Atual:** Taxa fixa sem consideração dos custos reais de cada método de pagamento
- **Impacto Financeiro:** Perda de margem devido às taxas não repassadas
- **Necessidade:** Flexibilidade para cada evento ter sua própria estratégia de pagamento
- **Benefício:** Transparência para o usuário e sustentabilidade financeira para organizadores

## 3. REQUISITOS FUNCIONAIS

### RF001 - Configuração de Métodos de Pagamento no Evento

- O sistema deve permitir configurar no cadastro do evento:
  - Métodos de pagamento aceitos (PIX, Cartão de Crédito, Cartão de Débito)
  - Número máximo de parcelas para cartão de crédito (1 a 12)
  - Se as taxas serão repassadas para o cliente
  - Taxas customizadas por método (opcional, senão usar padrão MercadoPago)

### RF002 - Seleção de Método de Pagamento na Inscrição

- O participante deve escolher o método de pagamento antes de prosseguir
- Sistema deve mostrar o valor final com taxas (se configurado)
- Validar se o método escolhido está disponível para o evento
- Para cartão de crédito, permitir seleção do número de parcelas

### RF003 - Cálculo Automático de Taxas

- Integrar com dados reais de taxas do MercadoPago:
  - PIX: ~1% (verificar valor atual)
  - Cartão de Crédito: varia por parcela
  - Cartão de Débito: ~2,99%
- Aplicar taxas somente se configurado no evento
- Exibir breakdown de custos para o usuário

### RF004 - Criação de Preferência Específica

- Gerar preferência do MercadoPago baseada na escolha do usuário
- Configurar métodos aceitos dinamicamente
- Definir número de parcelas permitidas
- Incluir taxa no valor se configurado

## 4. REQUISITOS NÃO FUNCIONAIS

### RNF001 - Performance

- Cálculo de taxas deve ser instantâneo (<500ms)
- Cache de taxas do MercadoPago por 24h

### RNF002 - Confiabilidade

- Usar taxas atualizadas do MercadoPago
- Fallback para taxas padrão em caso de erro na API

### RNF003 - Usabilidade

- Interface intuitiva para configuração de métodos
- Exibição clara dos custos para o participante
- Validação em tempo real

## 5. ESTRUTURA DE DADOS

### 5.1 Extensão da Tabela `events`

```sql
-- Novos campos na tabela events
ALTER TABLE events ADD COLUMN payment_config JSONB DEFAULT '{}';
```

### 5.2 Estrutura do payment_config

```typescript
interface PaymentConfig {
  methods: {
    pix: {
      enabled: boolean;
      passthrough_fee: boolean;
      custom_fee?: number; // Sobrescrever taxa padrão
    };
    credit_card: {
      enabled: boolean;
      max_installments: number; // 1 a 12
      passthrough_fee: boolean;
      custom_fees?: { [key: number]: number }; // Por parcela
    };
    debit_card: {
      enabled: boolean;
      passthrough_fee: boolean;
      custom_fee?: number;
    };
  };
  default_method?: "pix" | "credit_card" | "debit_card";
}
```

## 6. PLANO DE AÇÃO

### FASE 1: Pesquisa e Configuração Base (Dia 1) ✅

**6.1.1 Pesquisar Taxas Reais do MercadoPago**

- [x] Consultar documentação oficial do MercadoPago sobre taxas
- [x] Verificar se existe API para consultar taxas em tempo real
- [x] Definir estrutura de taxas padrão baseada em dados reais
- [x] Documentar taxas por método e parcela

**6.1.2 Atualizar Schema do Banco**

- [x] Criar migration para adicionar campo `payment_config` na tabela `events`
- [x] Atualizar schema do Prisma
- [x] Gerar tipos TypeScript

### FASE 2: Backend - Modelo e Validação (Dia 1-2) ✅

**6.2.1 Criar Schemas de Validação**

- [x] Criar schema Zod para `PaymentConfig`
- [x] Adicionar validação no schema de evento
- [x] Criar utilitários para calcular taxas

**6.2.2 Atualizar Controladores de Evento**

- [x] Modificar `POST /api/events` para aceitar `payment_config`
- [x] Modificar `PUT /api/events/:id` para atualizar configuração
- [x] Adicionar validação de métodos de pagamento

**6.2.3 Criar Serviço de Cálculo de Taxas**

- [x] Implementar classe `PaymentFeeCalculator`
- [x] Métodos para calcular taxa por método e parcela
- [x] Cache de taxas com TTL de 24h
- [x] Fallback para taxas offline

### FASE 3: Backend - API de Pagamento (Dia 2-3) ✅

**6.3.1 Atualizar Create Preference**

- [x] Modificar schema para aceitar método e parcelas escolhidos
- [x] Validar se método está habilitado no evento
- [x] Calcular valor final com taxas
- [x] Configurar preferência específica para o método

**6.3.2 Nova API de Métodos Disponíveis**

- [x] Criar `GET /api/events/:id/payment-methods`
- [x] Retornar métodos habilitados com valores calculados
- [x] Incluir simulação de parcelas para cartão

### FASE 4: Frontend - Cadastro de Evento (Dia 3-4) 🔄

**6.4.1 Atualizar Formulário de Evento**

- [x] Adicionar seção "Métodos de Pagamento"
- [x] Switches para habilitar/desabilitar métodos
- [x] Campo para número máximo de parcelas
- [x] Toggle para repasse de taxas
- [x] Preview dos valores com taxas

**6.4.2 Componente de Configuração de Pagamento**

- [x] Criar `PaymentConfigForm` component
- [x] Validação em tempo real
- [x] Simulador de taxas
- [x] Interface responsiva

### FASE 5: Frontend - Integração de Pagamentos ✅

#### 5.1 Componente de Seleção de Método ✅

- [x] **PaymentMethodSelector.tsx**: Componente React para seleção de métodos de pagamento
- [x] **Integração com API**: Busca opções de pagamento disponíveis
- [x] **Interface visual**: Cards com opções de PIX, cartão de crédito/débito
- [x] **Cálculo dinâmico**: Exibição de valores com taxas incluídas

#### 5.2 Integração no Fluxo de Inscrição ✅

- [x] **EventRegistrationModal atualizado**: Implementação de fluxo em etapas
- [x] **Steps do Ant Design**: Visualização clara das etapas do processo
- [x] **Controle de estado**: Gerenciamento adequado dos dados entre etapas
- [x] **Validação integrada**: Validação antes de avançar para próxima etapa

**Resultado**: Fluxo completo de 3 etapas:

1. **Dados Pessoais**: Formulário de inscrição tradicional
2. **Método de Pagamento**: Seleção com cálculo de taxas em tempo real
3. **Confirmação**: Resumo dos dados e finalização

---

### FASE 6: Testes e Validação ⏳

#### 6.1 Testes de Integração

- [ ] **Fluxo completo**: Testar desde configuração até pagamento
- [ ] **API endpoints**: Validar todos os endpoints criados
- [ ] **Cálculo de taxas**: Verificar precisão dos cálculos
- [ ] **Criação de preferências**: Testar integração com MercadoPago

#### 6.2 Testes de Interface

- [ ] **Responsividade**: Testar em diferentes tamanhos de tela
- [ ] **Usabilidade**: Validar fluxo do usuário
- [ ] **Acessibilidade**: Verificar conformidade básica
- [ ] **Performance**: Medir tempos de resposta

#### 6.3 Validação de Dados

- [ ] **Sandbox MercadoPago**: Testar com conta sandbox
- [ ] **Casos extremos**: Testar valores limites e erros
- [ ] **Validação de dados**: Testar schemas Zod
- [ ] **Estados de erro**: Validar tratamento de erros

---

### FASE 7: Documentação e Deploy ⏳

#### 7.1 Documentação

- [ ] **API**: Documentar endpoints criados
- [ ] **Configuração**: Guia para administradores
- [ ] **Troubleshooting**: Guia de resolução de problemas
- [ ] **Changelog**: Documentar mudanças implementadas

#### 7.2 Deploy e Monitoramento

- [ ] **Deploy de produção**: Aplicar mudanças em produção
- [ ] **Monitoramento**: Configurar alertas e logs
- [ ] **Rollback plan**: Plano de contingência
- [ ] **Validação pós-deploy**: Testes em ambiente real

---

## 📊 Status Atual da Implementação

**PROGRESSO: 83% COMPLETO** 🎯

### Fases Concluídas ✅

- ✅ **FASE 1**: Extensão do Schema Prisma (100%)
- ✅ **FASE 2**: Backend APIs e Controllers (100%)
- ✅ **FASE 3**: Interface de Administração (100%)
- ✅ **FASE 4**: Calculadora de Taxas (100%)
- ✅ **FASE 5**: Frontend - Integração de Pagamentos (100%)

### Fases Pendentes ⏳

- ⏳ **FASE 6**: Testes e Validação (0%)
- ⏳ **FASE 7**: Documentação e Deploy (0%)

**Próximo passo**: Iniciar FASE 6 com testes de integração do fluxo completo.

### FASE 6: Integração e Testes (Dia 5-6)

**6.6.1 Integração Completa**

- [ ] Conectar frontend com backend
- [ ] Testar fluxo completo de inscrição
- [ ] Validar cálculos de taxa
- [ ] Testar criação de preferência

**6.6.2 Testes**

- [ ] Testes unitários para cálculo de taxas
- [ ] Testes de integração da API
- [ ] Testes E2E do fluxo de pagamento
- [ ] Testes de edge cases

### FASE 7: Validação e Deploy (Dia 6-7)

**6.7.1 Testes em Sandbox**

- [ ] Configurar ambiente de teste MercadoPago
- [ ] Validar diferentes cenários de pagamento
- [ ] Testar webhooks com novos campos

**6.7.2 Documentação e Deploy**

- [ ] Atualizar documentação da API
- [ ] Criar guia de uso para organizadores
- [ ] Deploy em staging para validação
- [ ] Deploy em produção

## 7. ARQUIVOS A SEREM MODIFICADOS/CRIADOS

### Backend

- `prisma/schema.prisma` (adicionar payment_config)
- `prisma/migrations/` (nova migration)
- `backend/schemas/eventSchemas.ts` (schema PaymentConfig)
- `backend/utils/paymentFeeCalculator.ts` (nova classe)
- `app/api/events/route.ts` (aceitar payment_config)
- `app/api/events/[id]/route.ts` (update payment_config)
- `app/api/events/[id]/payment-methods/route.ts` (nova API)
- `app/api/payments/create-preference/route.ts` (modificar)

### Frontend

- `components/admin/PaymentConfigForm.tsx` (novo)
- `components/event/PaymentMethodSelector.tsx` (novo)
- `components/admin/EventModal.tsx` (modificar)
- `app/[slug]/page.tsx` (adicionar seleção de pagamento)
- `types/event.ts` (adicionar PaymentConfig)

## 8. RISCOS E MITIGAÇÕES

| Risco                     | Probabilidade | Impacto | Mitigação                      |
| ------------------------- | ------------- | ------- | ------------------------------ |
| Taxas MercadoPago mudarem | Média         | Alto    | Cache com TTL + fallback       |
| Complexidade do fluxo     | Alta          | Médio   | Testes extensivos + UX simples |
| Performance de cálculos   | Baixa         | Médio   | Cache + otimização             |
| Erro na integração        | Média         | Alto    | Sandbox + testes rigorosos     |

## 9. CRITÉRIOS DE ACEITAÇÃO

- [ ] Organizador consegue configurar métodos de pagamento no evento
- [ ] Participante vê apenas métodos habilitados para o evento
- [ ] Cálculo de taxas está correto e transparente
- [ ] Preferência MercadoPago é criada com configurações corretas
- [ ] Interface é intuitiva e responsiva
- [ ] Performance mantém padrão atual (<2s para inscrição)

## 10. CRONOGRAMA ESTIMADO

**Duração Total:** 7 dias úteis (1,5 semanas)

- **Dias 1-2:** Backend (Modelo + APIs)
- **Dias 3-4:** Frontend (Configuração + Seleção)
- **Dias 5-6:** Integração + Testes
- **Dia 7:** Validação + Deploy

## 11. RECURSOS NECESSÁRIOS

- Acesso à documentação atualizada do MercadoPago
- Conta sandbox para testes
- Tempo dedicado sem interrupções
- Validação com stakeholder antes do deploy

---

**Próximos Passos:**

1. Aprovar este documento
2. Pesquisar taxas atuais do MercadoPago
3. Iniciar Fase 1 do desenvolvimento

**Data de Revisão:** Após conclusão da Fase 2
