# RFC — Análise de Viabilidade da Feature de Inscrição em Lote

## Objetivo

Quero que você atue como um **Staff Software Engineer**, **Software Architect**, **Product Manager**, **Product Designer** e **Especialista em UX Mobile**.

Sua missão é realizar uma análise técnica completa para determinar a melhor forma de implementar uma funcionalidade de **Inscrição em Lote** neste sistema.

Nesta etapa **você NÃO deve implementar nada**.

Seu objetivo é compreender profundamente a arquitetura existente, avaliar riscos, propor soluções e, somente caso a conclusão seja positiva, elaborar um plano de implementação.

---

# Contexto do projeto

Este projeto é um sistema de inscrições para eventos.

Antes de iniciar qualquer análise, leia integralmente os documentos abaixo.

## Documentação obrigatória

- `doc/ARQUITETURA.md`
- `doc/FLUXO_INSCRICAO.md`

Caso durante a análise seja necessário compreender alguma implementação específica, consulte também:

- `doc/GUIA_DESENVOLVIMENTO.md`
- `doc/SOLUCAO_PREPARED_STATEMENTS.md`
- `doc/EXEMPLO_PRISMA_RETRY.md`
- `doc/REQUISITO_SISTEMA_PAGAMENTO_TAXAS.md`
- `doc/TAXAS_MERCADOPAGO_2025.md`

---

# Regra obrigatória

Antes de iniciar qualquer análise:

1. Leia completamente `doc/FLUXO_INSCRICAO.md`.
2. Considere este documento como a documentação oficial do fluxo atual.
3. Valide que a documentação corresponde ao código atual.
4. Caso encontre divergências entre documentação e código, considere o **código como fonte de verdade** e registre todas as divergências encontradas no relatório.
5. Não faça nenhuma suposição sobre o funcionamento atual sem antes consultar a documentação e o código.

---

# Público do sistema

O sistema possui milhares de usuários.

Aproximadamente **99% dos acessos acontecem em dispositivos móveis**.

Toda solução deve ser pensada **Mobile First**.

A experiência do usuário é um requisito tão importante quanto a arquitetura.

---

# Situação atual

Hoje o fluxo funciona da seguinte forma:

1. Usuário acessa um evento.
2. Clica em "Inscreva-se".
3. Preenche seus dados.
4. Escolhe modalidade (quando existir).
5. Escolhe camisa (quando disponível).
6. Gera um checkout.
7. Efetua o pagamento.
8. Após confirmação do pagamento pelo gateway, a inscrição é confirmada.

Hoje o sistema permite apenas:

- uma inscrição;
- um checkout;
- um pagamento.

Cada inscrição gera um único Registration.

Todo o comportamento atual está documentado em `doc/FLUXO_INSCRICAO.md`.

---

# Nova funcionalidade desejada

Desejo permitir que um único usuário possa cadastrar várias pessoas em uma única compra.

Exemplos:

- pai cadastrando esposa e filhos;
- treinador cadastrando uma equipe;
- empresa cadastrando funcionários;
- grupo de amigos.

---

## Fluxo imaginado

1. Usuário abre o evento.
2. Escolhe "Inscrição em lote".
3. Define quantos participantes deseja cadastrar.
4. Preenche o formulário individual de cada participante.
5. Cada participante pode escolher sua modalidade.
6. Cada participante pode escolher camisa ou não (quando disponível).
7. O sistema calcula automaticamente o valor total.
8. Apenas um checkout é criado.
9. Apenas um pagamento é realizado.
10. Após confirmação do pagamento todas as inscrições são confirmadas corretamente.

---

## Exemplo

Evento:

Sem camisa:

R$ 90

Com camisa:

R$ 120

Participantes:

Pessoa 1

- Com camisa

Pessoa 2

- Com camisa

Pessoa 3

- Sem camisa

Resultado esperado:

120 + 120 + 90 = R$ 330

O sistema gera:

- um único checkout;
- um único pagamento;
- três inscrições independentes.

---

# Objetivo da análise

Quero que você determine se esta funcionalidade realmente faz sentido para este sistema.

Não quero apenas uma confirmação.

Quero uma análise crítica.

Caso exista uma abordagem melhor do que inscrição em lote, apresente-a.

Caso existam riscos importantes, explique-os.

Caso considere inviável, justifique tecnicamente.

---

# Restrições

Toda a arquitetura existente deve ser preservada.

Reutilize o máximo possível das implementações atuais.

Evite criar abstrações desnecessárias.

Evite duplicação de lógica.

---

# Compatibilidade obrigatória

A nova solução deve manter compatibilidade com:

- fluxo de eventos gratuitos;
- fluxo de eventos pagos;
- campos fixos;
- campos dinâmicos;
- todos os tipos de campos dinâmicos;
- validações existentes;
- validação de CPF;
- deduplicação por CPF;
- seleção de camisa;
- cálculo de preço exclusivamente no backend;
- disponibilidade de vagas;
- período de inscrição;
- webhook;
- recuperação de pagamento;
- fluxo "Continuar pagamento";
- geração de comprovantes;
- segurança contra manipulação de valores.

Nenhuma dessas funcionalidades pode ser perdida.

---

# Pontos obrigatórios da análise

## 1. Arquitetura

Analise:

- impacto na arquitetura atual;
- impacto na manutenção;
- impacto na escalabilidade;
- impacto na legibilidade;
- impacto em futuras funcionalidades.

---

## 2. Modelagem

Determine qual seria a melhor modelagem.

Avalie alternativas como:

- Registration pai contendo Registration filhos;
- Order contendo inscrições;
- Checkout contendo inscrições;
- Payment compartilhado;
- Batch Registration;
- outra abordagem.

Apresente vantagens e desvantagens.

Escolha apenas uma solução recomendada.

---

## 3. Banco de dados

Analise:

- novas tabelas;
- alterações em tabelas existentes;
- relacionamentos;
- migrations;
- índices;
- integridade referencial.

---

## 4. Backend

Analise:

- criação das inscrições;
- geração do checkout;
- cálculo do valor total;
- rollback;
- transações;
- concorrência;
- idempotência;
- webhook;
- recuperação após falhas;
- reprocessamento.

---

## 5. Frontend

Analise:

- reaproveitamento do formulário atual;
- reaproveitamento dos componentes existentes;
- impacto nas telas;
- impacto na navegação.

---

## 6. UX Mobile

Este ponto é extremamente importante.

Pense como um usuário comum utilizando apenas um celular.

Analise:

- facilidade de uso;
- tempo de preenchimento;
- número de cliques;
- barra de progresso;
- indicadores visuais;
- edição de participantes;
- exclusão de participantes;
- adicionar novo participante;
- copiar dados do responsável;
- revisão antes do pagamento;
- acessibilidade.

Quero a melhor experiência possível.

---

## 7. Performance

Avalie cenários de:

- 2 participantes;
- 5 participantes;
- 10 participantes;
- 20 participantes.

Analise:

- renderização;
- consumo de memória;
- payload;
- processamento;
- banco;
- API.

---

## 8. Casos de borda

Analise todos os cenários abaixo:

- CPF já inscrito;
- email repetido;
- telefone repetido;
- participante inválido;
- modalidade esgotada;
- vagas encerradas;
- alteração de preço;
- alteração do evento durante preenchimento;
- pagamento recusado;
- pagamento expirado;
- abandono do checkout;
- webhook duplicado;
- webhook atrasado;
- timeout do gateway;
- falha após criação parcial das inscrições;
- falha durante webhook;
- campos dinâmicos obrigatórios;
- alteração de configuração do evento durante o processo.

Explique como cada caso deve ser tratado.

---

## 9. Integridade

Explique como garantir que:

- nenhuma inscrição fique perdida;
- nenhuma inscrição seja duplicada;
- nenhuma inscrição fique sem pagamento;
- nenhuma inscrição seja confirmada incorretamente;
- nenhuma inconsistência seja criada.

---

## 10. Segurança

Analise possíveis vulnerabilidades:

- manipulação de preço;
- manipulação da modalidade;
- manipulação da camisa;
- manipulação dos participantes;
- fraude;
- replay de webhook;
- ataques de concorrência.

---

## 11. Escalabilidade

Analise:

- crescimento da base;
- milhares de inscrições;
- milhares de pagamentos;
- impacto em futuras funcionalidades.

---

# Formato obrigatório do documento

O documento final deve seguir o formato de um RFC técnico.

Estrutura obrigatória:

1. Resumo Executivo
2. Contexto
3. Problema
4. Objetivos
5. Fora de Escopo
6. Alternativas Avaliadas
7. Arquitetura Recomendada
8. Modelagem de Dados
9. Fluxo Backend
10. Fluxo Frontend
11. Fluxo Mobile
12. Compatibilidade com funcionalidades existentes
13. Casos de Borda
14. Segurança
15. Performance
16. Escalabilidade
17. Riscos
18. Estratégia de Migração
19. Estratégia de Rollback
20. Estratégia de Testes
21. Conclusão

---

# Conclusão

Ao final escolha apenas uma opção.

- ✅ Recomendo implementar
- ⚠️ Recomendo implementar com ajustes
- ❌ Não recomendo implementar

Justifique detalhadamente.

---

# Plano de implementação

**Somente se a conclusão for positiva**.

Caso a conclusão seja favorável, elabore um plano completo de implementação.

Divida o plano em pequenas fases.

Cada fase deve conter:

- objetivo;
- descrição;
- dependências;
- arquivos que provavelmente serão alterados;
- riscos;
- checklist;
- estratégia de testes;
- critérios de aceite.

Cada etapa deve ser pequena, facilmente revisável e facilmente testável.

---

# Restrições durante esta análise

Durante esta etapa você NÃO deve:

- escrever código;
- modificar arquivos;
- criar migrations;
- alterar schemas;
- alterar APIs;
- implementar funcionalidades;
- sugerir patches.

Seu único objetivo é produzir um RFC técnico completo.

---

# Implementação futura

Quando eu autorizar a implementação:

A primeira tarefa obrigatória será:

```bash
git checkout -b feature/batch-registrations
```

Nenhum arquivo poderá ser alterado antes da criação da branch.

Depois disso:

- seguir rigorosamente o plano aprovado;
- executar uma fase por vez;
- validar cada fase antes da próxima;
- caso encontre um risco não previsto, interromper a implementação e apresentar o problema antes de continuar.

---

# Objetivo final

O objetivo não é apenas adicionar uma nova funcionalidade.

O objetivo é construir a melhor solução possível para permitir múltiplas inscrições em uma única compra, preservando a arquitetura existente, garantindo consistência dos dados, excelente experiência para usuários mobile, alta escalabilidade e facilidade de manutenção futura.
