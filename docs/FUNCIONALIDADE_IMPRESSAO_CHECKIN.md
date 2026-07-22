# Funcionalidade de Impressão/Exportação de Check-in

## Descrição

Foi implementada uma funcionalidade completa de impressão e exportação da lista de participantes do evento na página de check-in.

## Arquivos Criados/Modificados

### 1. Nova Rota API: `/app/api/registrations/export/route.ts`

- **Funcionalidade**: Retorna todos os participantes confirmados de um evento específico sem paginação
- **Parâmetros**: `eventId` (obrigatório)
- **Retorno**:
  - Informações completas do evento
  - Lista completa de participantes confirmados
  - Estatísticas consolidadas (total, check-ins, pendentes, taxa de presença, receita)
  - Data/hora da exportação

### 2. Componente de Impressão: `/components/CheckinReportPrint.tsx`

- **Funcionalidade**: Componente React formatado para impressão
- **Características**:
  - Layout otimizado para impressão
  - Cabeçalho com informações do evento
  - Estatísticas em cards visuais
  - Tabela completa de participantes
  - Status visual de check-in
  - Espaço para assinaturas manuais
  - Rodapé com informações adicionais
  - Estilos específicos para impressão (`@media print`)

### 3. Página de Check-in Atualizada: `/app/checkin/page.tsx`

- **Novas funcionalidades**:
  - Botão "Imprimir Lista" ao lado do botão "Atualizar Lista"
  - Modal de pré-visualização do relatório
  - Opções de exportação (Imprimir e CSV)
  - Estados para controle da exportação e modal

## Funcionalidades Implementadas

### 1. **Botão de Impressão**

- Localizado na seção de participantes confirmados
- Carrega todos os dados do evento selecionado
- Abre modal com pré-visualização do relatório

### 2. **Modal de Pré-visualização**

- Mostra o relatório formatado antes da impressão
- Permite visualizar como ficará o documento impresso
- Opções de ação no rodapé do modal

### 3. **Impressão Direta**

- Abre nova janela do navegador com o relatório formatado
- Layout otimizado para impressão em papel A4
- Imprime automaticamente após carregar

### 4. **Exportação CSV**

- Gera arquivo CSV com todos os dados dos participantes
- Nome do arquivo inclui nome do evento e data atual
- Download automático via navegador

## Informações Incluídas no Relatório

### Cabeçalho:

- Título do evento
- Local (se disponível)
- Data e horário do evento
- Data/hora de geração do relatório

### Estatísticas:

- Total de participantes confirmados
- Número de check-ins realizados
- Número aguardando check-in
- Taxa de presença (%)

### Lista de Participantes:

- Numeração sequencial
- Nome completo
- Email
- CPF formatado
- Telefone
- Status de check-in (visual)
- Data/hora do check-in
- Espaço para assinatura manual

### Rodapé:

- Receita total do evento
- Espaço para assinatura do responsável

## Como Usar

1. **Acesse a página de check-in** (`/checkin`)
2. **Selecione um evento** na lista suspensa
3. **Clique no botão "Imprimir Lista"** (ícone de impressora)
4. **Aguarde o carregamento** dos dados completos
5. **No modal que abrir**:
   - Para imprimir: clique em "Imprimir"
   - Para exportar CSV: clique em "Exportar CSV"
   - Para cancelar: clique em "Cancelar"

## Observações Técnicas

- A funcionalidade busca TODOS os participantes confirmados do evento (sem paginação)
- O relatório é otimizado para impressão em papel A4
- Os estilos de impressão ocultam elementos desnecessários
- O arquivo CSV é gerado no formato compatível com Excel
- As datas são formatadas no padrão brasileiro (DD/MM/YYYY)

## Benefícios

1. **Controle Físico**: Lista impressa para conferência manual
2. **Backup**: Arquivo CSV para backup dos dados
3. **Organização**: Relatório formatado e profissional
4. **Assinaturas**: Espaço para assinaturas dos participantes
5. **Estatísticas**: Visão consolidada do evento em uma página
