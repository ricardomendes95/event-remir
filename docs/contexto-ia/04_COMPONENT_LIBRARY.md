# 04 — Biblioteca de Componentes

Catálogo normativo. **Antes de criar qualquer componente, procure aqui um
similar.** Se existir: reutilizar/estender. Se não: avaliar se a peça é
reutilizável (→ criar genérica no domínio certo) ou específica (→ criar junto
da tela, sem generalizar prematuramente). Duplicação é proibida.

Base visual: **Ant Design 5** é a biblioteca padrão de primitivas (Button,
Input, Table, Modal, Form, Select, DatePicker, Skeleton, Empty, message,
Steps...). Só criamos componente próprio quando AntD não cobre o caso ou quando
há identidade visual própria (páginas públicas institucionais).

## Transversais (top-level `/components`)

| Componente | Responsabilidade | Usar quando | NÃO usar quando |
|---|---|---|---|
| `AntdProvider` | ConfigProvider/tema AntD + patch React 19 | Já aplicado no layout raiz | Nunca instanciar de novo |
| `Header` / `Footer` | Chrome das páginas públicas | Páginas públicas novas | Admin (usa `AdminHeader`) |
| `ImageUpload` | Upload de imagem via Cloudinary com preview | Qualquer upload de imagem | Upload de outros tipos de arquivo |
| `ShirtPhoto` | Miniatura da foto da camisa com ampliação e transformação Cloudinary (`utils/cloudinaryImage.ts`) | Etapa de camisa e compra posterior | Imagens que não sejam a da camisa |
| `MoneyInput` | Entrada de valores monetários BRL | Todo campo de dinheiro | Números não monetários (usar InputNumber) |
| `RichTextEditor` (+`LineHeight`) | Editor Tiptap p/ descrição de eventos | Texto rico no admin | Campos de texto simples |
| `CountdownTimer` | Contagem regressiva de evento | Destaque de urgência em evento | — |
| `PageTracker` | Dispara analytics de page view | Montado só por `PrivacyConsent` após consentimento | Nunca montar direto no layout ou por página |
| `PrivacyConsent` | Banner LGPD (Aceitar/Recusar) e gate do analytics | Já aplicado globalmente em `app/layout.tsx` | Estado em `lib/consent.ts` (`localStorage`); não criar outro banner |
| `ConsentPreferencesButton` | Reabre o banner de consentimento | Rodapé e `/privacidade` | — |
| `StructuredData` | JSON-LD para SEO | Páginas públicas indexáveis | Admin |
| `SearchComprovante` | Busca pública de inscrição por CPF | Home/página de evento | Buscas do admin (têm filtros próprios) |
| `RegistrationProofModal` | Comprovante com QR code; inclui "Solicitar cancelamento" / "Desistir do cancelamento" e o `ShirtPurchaseCard` (inscrição confirmada) | Exibir comprovante em qualquer contexto | Não recriar variações de comprovante; a impressão vive em `lib/registrationProofPrint.ts` e é reusada pela ação "Imprimir comprovante" do admin |
| `AutoShowProofModal` | Abre o comprovante automaticamente pós-fluxo | Retornos de fluxo de inscrição | — |
| `PaymentResultPage` | Corpo das páginas `/payment/*` | Páginas de retorno de gateway | — |
| `EmbeddedBrowserWarningModal` | Aviso p/ navegador embutido (Instagram etc.) | Junto de `redirectToPayment` | Nunca chamar isolado sem contexto de redirect |
| `CheckinReportPrint` | Relatório de impressão do check-in | Tela de check-in | — |

## Domínio `event` (`components/event`)

| Componente | Responsabilidade | Notas normativas |
|---|---|---|
| `EventDisplay` | Cartão/apresentação pública do evento (inclui lote vigente) | Toda listagem/destaque público de evento |
| `EventRegistrationModal` | **Coração do produto**: fluxo multi-etapas de inscrição (dados → pagamento/confirmação, camisa, continuar pagamento) | Mudanças aqui exigem ler `docs/FLUXO_INSCRICAO.md` e testar todos os cenários da matriz (gratuito/pago × formMode × camisa × continuar) |

## Domínio `registration` (`components/registration`)

| Componente | Responsabilidade | Notas |
|---|---|---|
| `RegistrationForm` | Campos fixos (nome, CPF, e-mail, telefone) com obrigatoriedade dinâmica | Único lugar que define os campos fixos |
| `DynamicFormRenderer` | Renderiza os 8 tipos de campo dinâmico + `buildRules` | Única implementação permitida de campos dinâmicos |
| `EventSummary` | Resumo do evento dentro do fluxo de inscrição | |
| `ExistingRegistrationAlert` | Alerta de CPF já inscrito + ações (comprovante/continuar); em pedido em grupo pendente oferece continuar o grupo ou sair (Opção C) | Par obrigatório do `useCpfVerification` |
| `BatchParticipantsSection` | Checkbox "Inscrever mais pessoas", quantidade e cartões recolhíveis (um formulário por pessoa, reaproveita `RegistrationForm`/`DynamicFormRenderer`) | Só no `EventRegistrationModal`, com `allowBatchRegistration` |
| `BatchOrderSummary` | Etapa de pagamento do grupo: pessoas, camisa por pessoa e total | Só compra em grupo paga |
| `ShirtPurchaseCard` | Cartão "Quer a camisa?" do comprovante: escolha de tamanho e ida ao pagamento (ou continuar pagamento pendente) | Só dentro do `RegistrationProofModal`, com `shirtPurchase.available` |
| `GroupProofModal` | Comprovante consolidado da compra em grupo; abre o `RegistrationProofModal` de cada pessoa | Pós-compra em grupo (paga ou gratuita) |

## Domínio `admin` (`components/admin`)

| Componente | Responsabilidade | Notas |
|---|---|---|
| `AdminHeader` | Chrome/navegação do admin | |
| `EventModal` | CRUD de evento (form completo, banner, rich text, camisa, lotes de inscrição, form dinâmico, toggle de inscrição em grupo) | |
| `DynamicFormBuilder` | Construtor visual dos campos dinâmicos | Par do `DynamicFormRenderer` |
| `UserManagement` / `UserModal` / `ChangePasswordModal` | Gestão de admins | Restrito a SUPER_ADMIN |
| `RegistrationsPrintReport` | Impressão de inscrições (listas por tamanho de camisa) | |
| `registrations/RegistrationFilters` | Seletor de evento (obrigatório) + busca, status, lote, pagamento, individual/grupo | Nada é carregado sem evento escolhido |
| `registrations/RegistrationTable` | Tabela de inscrições | Coluna Pagamento: tag do sub-método manual, responsável e indicador/tooltip de observação; tag "Grupo" (responsável) sob o participante de pedido em grupo; tag "Estorno em aberto"; ações: detalhes, status, Cancelar/Reativar (ADMIN+), comprovante, editar, excluir |
| `registrations/RegistrationStats` | Cards de estatísticas | Resumo de manuais por sub-método, "com observação" e estornos em aberto (por perfil) |
| `registrations/RegistrationDetailDrawer` | Detalhes da inscrição + linha do tempo (Drawer) | Usa o payload já sanitizado por perfil |
| `registrations/RegistrationModal` | Detalhe/edição de inscrição | Campos condicionais: sub-método (Manual), responsável (Dinheiro), observação (500 caracteres) |
| `financial/FinancialSummaryTab` | Aba "Prestação de contas" do Financeiro: filtros (evento, período), indicadores, tabelas por forma/lote/responsável do dinheiro/estornos, exportação CSV e impressão | A página `/admin/financial` usa abas; a futura aba "Auditoria" (req. 6) entra como novo item em `TAB_ITEMS`. Números vêm de `backend/utils/revenueBreakdown` (fonte única) |
| `financial/FinancialPrintReport` | Documento A4 retrato da prestação de contas de um evento (só aparece na impressão, via `print:block` + `@media print`) | Só com evento selecionado; tabelas legíveis em preto e branco |

## Domínio `home` (`components/home`)

`HeroSection`, `AboutSection`, `PastorsSection`, `MinistriesSection`,
`LocationSection`, `Card`, `Container` — seções institucionais da igreja.
Identidade visual própria (Tailwind + tokens). Usar `Container`/`Card` ao criar
novas seções institucionais para manter grid e espaçamento.

## Domínio `lives` (`components/lives`)

| Componente | Responsabilidade | Notas |
|---|---|---|
| `LivesContent` | Corpo da página pública `/lives`: busca `/api/lives` e mostra live atual, próximas e anteriores; sem API key mostra só o embed da live atual + link do canal | Tailwind (site público). Dados vêm de `backend/services/youtubeLivesService` |
| `LiveFacade` | Miniatura com botão "toque para assistir"; só então carrega o iframe `youtube-nocookie.com` | Usar para qualquer embed de terceiros (LGPD + 3G) |

## `ui` (`components/ui`)

| Componente | Responsabilidade | Notas |
|---|---|---|
| `Button` | Botão da identidade pública (primary/secondary/outline; sm/md/lg) | Usar nas **páginas públicas institucionais**. No admin, usar `Button` do AntD. Débito: cores hardcoded (ver `09`) |

## Regras de decisão para componente novo

1. AntD resolve? → usar AntD direto.
2. Existe similar neste catálogo? → reutilizar/estender (nunca copiar-colar).
3. Vai ser usado em 2+ telas ou é primitiva de identidade? → criar em
   `components/ui` (genérico) ou no domínio (específico), documentar **aqui**.
4. Uso único e acoplado a uma tela? → criar na pasta do domínio da tela, sem
   generalizar.

**Todo componente reutilizável novo deve ser adicionado a este catálogo na
mesma entrega.**
