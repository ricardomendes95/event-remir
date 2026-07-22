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
| `MoneyInput` | Entrada de valores monetários BRL | Todo campo de dinheiro | Números não monetários (usar InputNumber) |
| `RichTextEditor` (+`LineHeight`) | Editor Tiptap p/ descrição de eventos | Texto rico no admin | Campos de texto simples |
| `CountdownTimer` | Contagem regressiva de evento | Destaque de urgência em evento | — |
| `PageTracker` | Dispara analytics de page view | Já aplicado globalmente | Não duplicar por página |
| `StructuredData` | JSON-LD para SEO | Páginas públicas indexáveis | Admin |
| `SearchComprovante` | Busca pública de inscrição por CPF | Home/página de evento | Buscas do admin (têm filtros próprios) |
| `RegistrationProofModal` | Comprovante com QR code | Exibir comprovante em qualquer contexto | Não recriar variações de comprovante |
| `AutoShowProofModal` | Abre o comprovante automaticamente pós-fluxo | Retornos de fluxo de inscrição | — |
| `PaymentResultPage` | Corpo das páginas `/payment/*` | Páginas de retorno de gateway | — |
| `EmbeddedBrowserWarningModal` | Aviso p/ navegador embutido (Instagram etc.) | Junto de `redirectToPayment` | Nunca chamar isolado sem contexto de redirect |
| `CheckinReportPrint` | Relatório de impressão do check-in | Tela de check-in | — |

## Domínio `event` (`components/event`)

| Componente | Responsabilidade | Notas normativas |
|---|---|---|
| `EventDisplay` | Cartão/apresentação pública do evento | Toda listagem/destaque público de evento |
| `EventRegistrationModal` | **Coração do produto**: fluxo multi-etapas de inscrição (dados → pagamento/confirmação, camisa, continuar pagamento) | Mudanças aqui exigem ler `docs/FLUXO_INSCRICAO.md` e testar todos os cenários da matriz (gratuito/pago × formMode × camisa × continuar) |

## Domínio `registration` (`components/registration`)

| Componente | Responsabilidade | Notas |
|---|---|---|
| `RegistrationForm` | Campos fixos (nome, CPF, e-mail, telefone) com obrigatoriedade dinâmica | Único lugar que define os campos fixos |
| `DynamicFormRenderer` | Renderiza os 8 tipos de campo dinâmico + `buildRules` | Única implementação permitida de campos dinâmicos |
| `EventSummary` | Resumo do evento dentro do fluxo de inscrição | |
| `ExistingRegistrationAlert` | Alerta de CPF já inscrito + ações (comprovante/continuar) | Par obrigatório do `useCpfVerification` |

## Domínio `admin` (`components/admin`)

| Componente | Responsabilidade | Notas |
|---|---|---|
| `AdminHeader` | Chrome/navegação do admin | |
| `EventModal` | CRUD de evento (form completo, banner, rich text, camisa, form dinâmico) | |
| `DynamicFormBuilder` | Construtor visual dos campos dinâmicos | Par do `DynamicFormRenderer` |
| `ManualRegistrationModal` | Inscrição manual pelo admin | `paymentMethod = MANUAL` |
| `UserManagement` / `UserModal` / `ChangePasswordModal` | Gestão de admins | Restrito a SUPER_ADMIN |
| `RegistrationsPrintReport` | Impressão de inscrições (listas por tamanho de camisa) | |
| `registrations/RegistrationFilters` | Filtros da listagem | |
| `registrations/RegistrationTable` | Tabela de inscrições | |
| `registrations/RegistrationStats` | Cards de estatísticas | |
| `registrations/RegistrationModal` | Detalhe/edição de inscrição | |

## Domínio `home` (`components/home`)

`HeroSection`, `AboutSection`, `PastorsSection`, `MinistriesSection`,
`LocationSection`, `Card`, `Container` — seções institucionais da igreja.
Identidade visual própria (Tailwind + tokens). Usar `Container`/`Card` ao criar
novas seções institucionais para manter grid e espaçamento.

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
