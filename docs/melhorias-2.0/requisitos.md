Solicitação de melhorias

IMPORTANTE

Você já possui o contexto completo do projeto através do comando /preparar.

Sua missão não é implementar tudo de uma vez.

Quero que você:

Analise profundamente cada requisito.
Identifique impactos no banco de dados, backend, frontend e integrações.
Identifique riscos.
Verifique se existe alguma funcionalidade já pronta que possa ser reaproveitada.
Monte um plano de implementação.
Execute apenas UMA melhoria por vez.
Antes de iniciar a próxima melhoria, aguarde minha aprovação.

Sempre mantenha o padrão arquitetural existente do projeto.

Se durante a análise você identificar uma solução melhor do que a descrita abaixo, explique os motivos antes de implementá-la.

1. Melhorias no cadastro de participantes e pagamentos
   Objetivo

Melhorar o controle de inscrições manuais e do financeiro.

Alterações
Cadastro do participante

Adicionar um campo:

Observação

Este campo servirá para registrar informações como:

pagamento realizado em espécie;
em posse de qual responsável está o dinheiro;
qualquer observação administrativa.
Cadastro manual

Hoje existe:

Manual
Mercado Pago

Alterar para:

InfinitePay (inscrição realizada pelo site)
Manual

Quando a inscrição for Manual, exibir:

método de pagamento
PIX
Dinheiro
Cartão
Observação
Financeiro

Quando o pagamento for em dinheiro:

identificar claramente que o pagamento foi em espécie;
exibir a observação cadastrada;
permitir identificar quem está responsável pelo dinheiro.

Analisar impacto em:

relatórios;
dashboard financeiro;
exportações. 2. Inscrição em lote

Criar uma funcionalidade que permita realizar várias inscrições em um único processo de pagamento.

O objetivo é:

cadastrar vários participantes;
gerar apenas um pagamento;
vincular todos os participantes ao mesmo pedido.

Analisar impacto em:

checkout;
comprovante;
financeiro;
confirmação de pagamento. 3. Sistema de lotes do evento

tem um documento que ja tem muita coisa o docs/RFC_INSCRICAO_EM_LOTE.md

Adicionar suporte a lotes.

Exemplo:

1º Lote
2º Lote
3º Lote

Cada lote deverá possuir:

nome;
período;
quantidade de vagas;
prioridade;
preço próprio.

A inscrição deverá obedecer ao lote ativo.

4. Foto da camisa

Na etapa de escolha da camisa:

Adicionar upload opcional de imagem.

Objetivo:

Mostrar uma foto da camisa do evento.

Analisar:

armazenamento;
compressão;
cache;
impacto no painel administrativo. 5. Compra posterior da camisa

Hoje:

Após pagar a inscrição, o participante não consegue adicionar a camisa.

Objetivo:

Permitir que um inscrito já confirmado possa posteriormente adquirir apenas a camisa.

Quero que seja feita uma análise da melhor experiência para isso.

A solução deve:

atualizar o cadastro existente;
gerar cobrança apenas da camisa;
manter histórico financeiro;
atualizar comprovante.

Evitar duplicidade de inscrições.

6. Auditoria financeira do InfinitePay

O InfinitePay gera:

CSV
OFX

Quero uma tela de auditoria financeira.

Objetivo:

Conferir pagamentos recebidos no InfinitePay com as inscrições existentes.

Analisar profundamente a melhor estratégia.

Possivelmente será necessário armazenar:

ID da transação;
ID do checkout;
link de pagamento;
status;
data;
valor;
demais identificadores retornados pela API.

Também avaliar:

webhooks;
sincronização;
auditoria permanente;
divergências;
pagamentos não encontrados;
pagamentos duplicados. 7. Página de transmissões ao vivo

Criar uma página que mostre automaticamente:

lives em andamento;
próximas lives (caso a API permita);
lives encerradas.

A página deve utilizar o canal oficial da igreja.

Primeiro faça uma análise de viabilidade técnica.

8. Novo painel administrativo

O painel atual mistura componentes do site público.

Quero um layout específico para administradores.

Objetivos:

dashboard inicial;
menu exclusivo;
melhor organização;
experiência semelhante a um sistema administrativo. 9. Melhorias na tela de inscrições

Hoje a tela já carrega dados antes da seleção do evento.

Alterar para:

Somente carregar informações após selecionar um evento.

Na tabela adicionar ações:

visualizar detalhes da inscrição;
visualizar data do pagamento;
visualizar histórico;
imprimir comprovante. 10. Melhorias no financeiro

Quero transformar essa tela em uma verdadeira prestação de contas.

Além da exportação em XLS:

Adicionar impressão do dashboard.

Adicionar indicadores como:

total de inscritos;
inscritos com camisa;
inscritos sem camisa;
receita apenas das inscrições;
receita das camisas;
receita total;
valores recebidos;
pendências.

Quando houver camisa:

Exibir informações como:

X pessoas compraram inscrição + camisa.

X pessoas compraram apenas inscrição.

Tudo deve ficar extremamente claro para apresentação aos responsáveis pelo evento.

11. Controle de permissões

Criar sistema de perfis.

Admin

Acesso total.

Check-in

Pode apenas:

localizar inscritos;
realizar check-in.

Não pode:

visualizar financeiro;
editar eventos;
cancelar inscrições.
Suporte

Pode:

cadastrar inscrições;
editar inscrições;
visualizar inscritos;
cadastrar eventos.

Não pode:

visualizar valores financeiros;
visualizar dashboard financeiro.

Cada perfil deverá possuir seu próprio dashboard.

12. Cancelamento e estorno

Hoje não existe fluxo de cancelamento.

Criar fluxo completo.

Administração

Permitir:

cancelar inscrição;
registrar estorno;
acompanhar status.
Área do participante

No comprovante deverá existir:

Solicitar cancelamento.

Ao clicar:

registrar solicitação;
exibir mensagem de sucesso.
Painel administrativo

Criar uma tela:

Solicitações de estorno.

Cada solicitação deverá possuir:

dados do participante;
motivo;
data;
status;
botão "Entrar em contato".

Este botão deverá abrir o WhatsApp já com uma mensagem pronta utilizando o telefone informado pelo participante.

InfinitePay

Verificar se existe endpoint oficial para estorno.

Caso exista:

Analisar implementação automática.

Fluxo esperado:

solicitar estorno;
executar estorno na InfinitePay;
atualizar status da inscrição;
atualizar financeiro;
registrar auditoria.

Caso o participante desista do cancelamento:

Deverá ser possível retornar ao fluxo de pagamento e reativar a inscrição, mantendo o mesmo cadastro do participante.

A atualização deverá ocorrer utilizando o CPF como identificador principal, evitando inscrições duplicadas.

Instruções finais

Antes de implementar cada melhoria:

faça uma análise técnica detalhada;
identifique impactos;
proponha a arquitetura;
liste os arquivos que serão alterados;
identifique riscos.

Após isso:

implemente apenas uma melhoria;
execute testes;
atualize a documentação, se necessário;
aguarde minha aprovação antes de iniciar a próxima.

A única alteração conceitual que eu faria é mudar a ordem de implementação. Eu começaria pelo que cria a base do sistema e evita retrabalho:

Controle de permissões (item 11)
Cadastro e pagamentos (item 1)
Sistema de lotes (item 3)
Inscrição em lote (item 2)
Cancelamento e estorno (item 12)
Auditoria do InfinitePay (item 6)
Melhorias da tela de inscrições (item 9)
Financeiro (item 10)
Compra posterior da camisa (item 5)
Upload da foto da camisa (item 4)
Novo painel administrativo (item 8)
Página de lives (item 7)

Essa sequência reduz retrabalho, porque primeiro estabelece as estruturas de permissão, cadastro e regras de negócio, deixando as melhorias visuais e complementares para o final.
