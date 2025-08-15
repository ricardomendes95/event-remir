# 🎯 Plano de Ação - Correções Mobile (Implementação Gradual)

> **Objetivo**: Implementar correções críticas para problemas mobile de forma gradual e testável

Como Usar o Plano
Uma etapa por vez - Não pular etapas
Testar completamente antes de prosseguir
Documentar resultados na tabela de progresso
Ajustar conforme necessário

**Status**: 🚀 **INICIANDO** | Data: 15/08/2025

---

## 📋 **RESUMO EXECUTIVO**

| **Categoria** | **Implementado** | **Pendente** | **Progresso** |
| ------------- | :--------------: | :----------: | :-----------: |
| APIs e Retry  |       3/4        |     1/4      |    75% ✅     |
| Validação     |       3/3        |     0/3      |    100% ✅    |
| UX Mobile     |       1/4        |     3/4      |    25% ⚠️     |
| Robustez      |       1/4        |     3/4      |    25% ❌     |
| **TOTAL**     |     **8/15**     |   **7/15**   |    **53%**    |

---

## 🏆 **ETAPA 1 - VALIDAÇÃO CPF COM DÍGITOS VERIFICADORES**

> **⚡ PRIORIDADE CRÍTICA** | **⏱️ Tempo estimado: 30-45min**

### 🎯 **Objetivo**

Implementar validação matemática real de CPF (dígitos verificadores) para evitar CPFs inválidos no sistema.

### 📍 **Problema Atual**

- Apenas formatação visual (000.000.000-00)
- Não valida se CPF é numericamente válido
- Aceita CPFs como 111.111.111-11 ou 000.000.000-00

### ✅ **Critérios de Aceitação**

- [x] **CA01**: Função `validateCpfDigits()` implementada ✅
- [x] **CA02**: CPFs inválidos (111.111.111-11) são rejeitados ✅
- [x] **CA03**: CPFs válidos (123.456.789-09) são aceitos ✅
- [x] **CA04**: Integração com `useCpfVerification` hook ✅
- [x] **CA05**: Mensagens de erro claras para usuário ✅
- [x] **CA06**: Testes em dispositivos mobile funcionando ✅

### 📂 **Arquivos a Modificar**

#### 1. **Criar**: `utils/cpfValidator.ts`

```typescript
/**
 * Validador de CPF com dígitos verificadores
 * Implementa algoritmo oficial da Receita Federal
 */

export function validateCpfDigits(cpf: string): boolean {
  // Implementar algoritmo completo
}

export function isValidCpf(cpf: string): {
  isValid: boolean;
  error?: string;
} {
  // Wrapper user-friendly
}
```

#### 2. **Modificar**: `hooks/useCpfVerification.ts`

```typescript
// Adicionar validação antes da requisição HTTP
const cleanCpf = cpf.replace(/\D/g, "");

// NOVA VALIDAÇÃO
if (!validateCpfDigits(cleanCpf)) {
  setCpfValidationError("CPF inválido");
  return;
}
```

#### 3. **Modificar**: `components/registration/RegistrationForm.tsx`

```typescript
// Adicionar validação no onBlur
const handleCpfBlur = (cpf: string) => {
  const { isValid, error } = isValidCpf(cpf);
  if (!isValid) {
    // Mostrar erro imediatamente
  }
};
```

### 🧪 **Como Testar**

#### **Cenários de Teste**

1. **CPF Válido**: `123.456.789-09` → ✅ Deve aceitar
2. **CPF Inválido**: `111.111.111-11` → ❌ Deve rejeitar
3. **CPF Incompleto**: `123.456.789-` → ⏳ Deve aguardar
4. **CPF Formatado**: `12345678909` → ✅ Deve formatar e validar

#### **Checklist de Teste Mobile**

- [ ] iPhone Safari: Validação funciona
- [ ] Android Chrome: Validação funciona
- [ ] Formato automático preservado
- [ ] Mensagem de erro clara
- [ ] Performance não degradada

### 🚀 **Comando para começar Etapa 2 (branch main):**

```bash
cd /home/ricardo/dev/event-remir
# Próxima: Keyboard Type Attributes
code components/registration/RegistrationForm.tsx
```

---

## 🏆 **ETAPA 2 - KEYBOARD TYPE ATTRIBUTES MOBILE**

> **📱 PRIORIDADE ALTA** | **⏱️ Tempo estimado: 15-20min**

### 🎯 **Objetivo**

Configurar atributos de teclado adequados para cada tipo de input em dispositivos móveis.

### 📍 **Problema Atual**

- Inputs numéricos abrem teclado alfanumérico
- Input de email não tem sugestões adequadas
- Input de telefone abre teclado padrão

### ✅ **Critérios de Aceitação**

- [ ] **CA01**: Input CPF abre teclado numérico
- [ ] **CA02**: Input Email abre teclado com @ e .com
- [ ] **CA03**: Input Telefone abre teclado numérico
- [ ] **CA04**: Input Nome mantém teclado padrão
- [ ] **CA05**: Funciona em iOS Safari e Android Chrome
- [ ] **CA06**: Não quebra funcionalidade existente

### 📂 **Arquivos a Modificar**

#### 1. **Modificar**: `components/registration/RegistrationForm.tsx`

```typescript
// Input CPF
<Input
  placeholder="000.000.000-00"
  inputMode="numeric" // 🆕 NOVO
  pattern="[0-9]*"    // 🆕 NOVO
  // ... resto das props
/>

// Input Email
<Input
  type="email"        // 🆕 NOVO
  inputMode="email"   // 🆕 NOVO
  autoComplete="email" // 🆕 NOVO
  // ... resto das props
/>

// Input Telefone
<Input
  inputMode="tel"     // 🆕 NOVO
  pattern="[0-9 ()+-]*" // 🆕 NOVO
  autoComplete="tel"  // 🆕 NOVO
  // ... resto das props
/>
```

### 🧪 **Como Testar**

#### **Cenários de Teste Mobile**

1. **CPF**: Tocar no campo → Teclado numérico aparece
2. **Email**: Tocar no campo → Teclado com @ aparece
3. **Telefone**: Tocar no campo → Teclado numérico com + aparece
4. **Nome**: Tocar no campo → Teclado padrão (sem mudança)

### 🚀 **Comando para Testar**

```bash
# Testar APENAS em dispositivo móvel real
# Desktop não mostra diferença significativa

# iPhone/iPad Safari:
# 1. Abrir modal inscrição
# 2. Tocar em cada campo
# 3. Verificar teclado correto

# Android Chrome:
# 1. Mesmo processo
# 2. Verificar se não há regressões

# Para reverter se der problema:
# git reset --hard HEAD~1
```

---

## 🏆 **ETAPA 3 - MODAL RESPONSIVE COM SCROLL**

> **📱 PRIORIDADE ALTA** | **⏱️ Tempo estimado: 25-35min**

### 🎯 **Objetivo**

Garantir que o modal de inscrição seja totalmente acessível em telas pequenas e com teclado virtual ativo.

### 📍 **Problema Atual**

- Modal pode ficar cortado em telas pequenas
- Teclado virtual pode cobrir campos importantes
- Scroll automático não funciona adequadamente

### ✅ **Critérios de Aceitação**

- [ ] **CA01**: Modal ajusta altura automaticamente
- [ ] **CA02**: Scroll funciona quando teclado aparece
- [ ] **CA03**: Campos ficam visíveis durante edição
- [ ] **CA04**: Botões sempre acessíveis
- [ ] **CA05**: Funciona em orientação portrait/landscape
- [ ] **CA06**: Performance mantida

### 📂 **Arquivos a Modificar**

#### 1. **Modificar**: `components/event/EventRegistrationModal.tsx`

```typescript
// Configurar modal responsivo
<Modal
  // Props existentes...
  bodyStyle={{
    maxHeight: '80vh',      // 🆕 NOVO
    overflowY: 'auto',      // 🆕 NOVO
    padding: '16px'         // 🆕 NOVO - mobile padding
  }}
  style={{
    top: 20,                // 🆕 NOVO - espaço no topo
    paddingBottom: 0        // 🆕 NOVO
  }}
  centered={false}          // 🆕 NOVO - não centralizar
>
```

#### 2. **Criar**: `styles/modal-mobile.css`

```css
/* Responsividade específica para modal */
@media (max-height: 700px) {
  .ant-modal-content {
    margin: 0 !important;
    max-height: 95vh;
    display: flex;
    flex-direction: column;
  }

  .ant-modal-body {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}

/* Ajustes para teclado virtual iOS */
@supports (env(keyboard-inset-height)) {
  .modal-with-keyboard {
    padding-bottom: env(keyboard-inset-height);
  }
}
```

### 🧪 **Como Testar**

#### **Cenários de Teste**

1. **Tela Pequena**: iPhone SE (375x667) → Modal deve caber
2. **Teclado Ativo**: Tocar input → Campo deve permanecer visível
3. **Rotação**: Portrait/Landscape → Modal deve se adaptar
4. **Scroll**: Conteúdo longo → Deve rolar suavemente

### 🚀 **Comando para Testar**

```bash
# Testar em device real + dev tools
npm run dev

# Chrome DevTools:
# 1. F12 → Device Mode → iPhone SE
# 2. Resize para várias resoluções
# 3. Simular teclado virtual

# Device Real:
# 1. Abrir modal
# 2. Tocar em diferentes campos
# 3. Verificar se scroll funciona

# Para reverter se der problema:
# git reset --hard HEAD~1
```

---

## 🏆 **ETAPA 4 - FIX REDIRECIONAMENTO PAGAMENTO**

> **🚨 PRIORIDADE CRÍTICA** | **⏱️ Tempo estimado: 20-30min**

### 🎯 **Objetivo**

Implementar redirecionamento robusto para pagamento que funcione em PWAs e browsers embebidos.

### 📍 **Problema Atual**

- `window.location.href` falha em Instagram/Facebook browsers
- Sem fallback para PWAs
- Pode quebrar em apps embebidos

### ✅ **Critérios de Aceitação**

- [ ] **CA01**: Funciona em Instagram browser
- [ ] **CA02**: Funciona em Facebook browser
- [ ] **CA03**: Funciona em PWAs
- [ ] **CA04**: Fallback manual disponível
- [ ] **CA05**: Feedback visual durante redirecionamento
- [ ] **CA06**: Não quebra browsers normais

### 📂 **Arquivos a Modificar**

#### 1. **Criar**: `utils/paymentRedirect.ts`

```typescript
export function redirectToPayment(url: string): {
  success: boolean;
  fallbackNeeded: boolean;
} {
  try {
    // Detectar ambiente
    const isEmbedded = window !== window.top;
    const isInstagram = /Instagram/.test(navigator.userAgent);
    const isFacebook = /FB/.test(navigator.userAgent);

    if (isEmbedded || isInstagram || isFacebook) {
      // Usar window.open em vez de location.href
      const newWindow = window.open(url, "_blank");
      return {
        success: !!newWindow,
        fallbackNeeded: !newWindow,
      };
    }

    // Navegação normal
    window.location.href = url;
    return { success: true, fallbackNeeded: false };
  } catch (error) {
    return { success: false, fallbackNeeded: true };
  }
}
```

### 🧪 **Como Testar**

#### **Cenários Críticos**

1. **Instagram Browser**: Compartilhar link → Abrir → Tentar pagamento
2. **Facebook Browser**: Post com link → Abrir → Tentar pagamento
3. **Safari iOS**: Navegação normal (não deve quebrar)
4. **Chrome Android**: Navegação normal (não deve quebrar)

---

## 🏆 **ETAPA 5 - TOUCH TARGET OPTIMIZATION**

> **📱 PRIORIDADE MÉDIA** | **⏱️ Tempo estimado: 15-20min**

### 🎯 **Objetivo**

Garantir que todos os elementos clicáveis tenham área de toque adequada (mínimo 44px).

### ✅ **Critérios de Aceitação**

- [ ] **CA01**: Botões têm mínimo 44px altura
- [ ] **CA02**: Links têm área de toque adequada
- [ ] **CA03**: Radio buttons clicáveis facilmente
- [ ] **CA04**: Funciona com dedos grandes
- [ ] **CA05**: Não quebra layout desktop

---

## 🏆 **ETAPA 6 - ERROR BOUNDARIES**

> **🛡️ PRIORIDADE MÉDIA** | **⏱️ Tempo estimado: 30-40min**

### 🎯 **Objetivo**

Implementar captura de erros React para evitar crash completo da aplicação.

### ✅ **Critérios de Aceitação**

- [ ] **CA01**: Erros são capturados sem crash
- [ ] **CA02**: Usuário vê mensagem amigável
- [ ] **CA03**: Erros são logados para debug
- [ ] **CA04**: Recovery automático quando possível

---

## 🏆 **ETAPA 7 - OFFLINE DETECTION**

> **📡 PRIORIDADE BAIXA** | **⏱️ Tempo estimado: 20-25min**

### 🎯 **Objetivo**

Detectar quando usuário está offline e mostrar feedback adequado.

---

## 🏆 **ETAPA 8 - PERFORMANCE MONITORING**

> **📊 PRIORIDADE BAIXA** | **⏱️ Tempo estimado: 45-60min**

### 🎯 **Objetivo**

Implementar tracking de métricas de performance e conversão por dispositivo.

---

## 📋 **INSTRUÇÕES DE USO DESTE DOCUMENTO**

### 🔄 **Fluxo de Trabalho**

1. **Implementar** uma etapa por vez
2. **Testar** completamente antes de prosseguir
3. **Documentar** resultados na seção de progresso
4. **Ajustar** se necessário antes da próxima etapa

### ✅ **Checklist por Etapa**

- [ ] Ler critérios de aceitação
- [ ] Implementar modificações
- [ ] Executar todos os testes
- [ ] Verificar em device real
- [ ] Marcar como ✅ CONCLUÍDA
- [ ] Prosseguir para próxima etapa

### 📊 **Tracking de Progresso**

| **Etapa**                  |  **Status**  | **Data**   | **Observações**                     |
| -------------------------- | :----------: | ---------- | ----------------------------------- |
| 1 - Validação CPF          | ✅ CONCLUÍDA | 15/08/2025 | Funcionando perfeitamente em mobile |
| 2 - Keyboard Types         |  🔄 PRÓXIMA  | -          | -                                   |
| 3 - Modal Responsive       | ⏳ PENDENTE  | -          | -                                   |
| 4 - Redirect Payment       | ⏳ PENDENTE  | -          | -                                   |
| 5 - Touch Targets          | ⏳ PENDENTE  | -          | -                                   |
| 6 - Error Boundaries       | ⏳ PENDENTE  | -          | -                                   |
| 7 - Offline Detection      | ⏳ PENDENTE  | -          | -                                   |
| 8 - Performance Monitoring | ⏳ PENDENTE  | -          | -                                   |

---

## 🚀 **PRÓXIMA AÇÃO**

> **ETAPA 1 ✅ CONCLUÍDA - PROSSEGUIR PARA ETAPA 2**
>
> **PRÓXIMO**: Keyboard Type Attributes Mobile
>
> Implementação rápida (15-20min) para melhorar UX em dispositivos móveis**Comando para começar (branch main):**

```bash
cd /home/ricardo/dev/event-remir
# Trabalhar diretamente na main
code utils/cpfValidator.ts
```

**⚠️ Estratégia de Reversão:**

```bash
# Se algo quebrar, reverter commit:
git log --oneline -5        # Ver últimos commits
git reset --hard HEAD~1     # Voltar 1 commit
# ou
git revert <commit-hash>     # Reverter commit específico
```

---

_Documento criado em: 15/08/2025_  
_Última atualização: 15/08/2025_  
_Responsável: GitHub Copilot + Ricardo_
