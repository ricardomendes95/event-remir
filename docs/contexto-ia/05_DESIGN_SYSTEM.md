# 05 — Design System

Normativo. Define o padrão visual do Event Remir. Melhorias de UI validadas em
telas novas **atualizam este documento** e passam a ser o padrão oficial.

## 1. Fundações

### Cores (tokens em `app/globals.css`, expostos ao Tailwind via `@theme inline`)

| Token | Valor | Uso |
|---|---|---|
| `--primary-700` | `#015C91` | **Cor base da marca** — ações primárias, links, foco |
| `--primary-50…900` | escala azul | Fundos suaves (50–100), hovers (600/800), textos sobre claro (700+) |
| `--success-500/600/700` | verdes | Confirmação, inscrição confirmada, pagamento aprovado |
| `--warning-500/600/700` | âmbar | Pendências (pagamento pendente), avisos |
| `--error-500/600/700` | vermelhos | Falhas, validação, cancelamento |
| `--background`/`--foreground` | `#fff`/`#171717` | Base clara (não há dark mode) |

**Regras:**
- Cor nova = token novo em `globals.css`. **Proibido hexadecimal hardcoded** em
  componente novo (o `ui/Button` legado viola isso — não repetir o padrão).
- Status de inscrição sempre com a mesma semântica: CONFIRMED=success,
  PENDING=warning, PAYMENT_FAILED/CANCELLED=error/neutro — em tags, cards e
  relatórios.
- Contraste mínimo WCAG AA (4.5:1 para texto). `--primary-700` sobre branco
  passa; tons ≤ 400 **não** servem para texto.

### Tipografia
- Fonte do sistema Next (Geist via `--font-sans`) nas páginas; AntD herda.
- Hierarquia: uma `h1` por tela; títulos de seção `h2`; não pular níveis.
- Corpo mínimo **16px** no mobile (evita zoom automático do iOS em inputs).

### Espaçamento e grid
- Escala Tailwind (múltiplos de 4px). Seções públicas usam
  `components/home/Container` para largura máxima e padding lateral.
- Formulários: 1 coluna no mobile; no desktop, campos curtos podem parear em
  grid de 2 colunas (padrão do `DynamicFormRenderer`: `textarea`, `radio` e
  `checkbox` múltiplo sempre em largura total).

## 2. Componentes visuais (quando usar cada padrão)

| Padrão | Quando usar |
|---|---|
| **Botões** — público: `ui/Button` (primary = ação principal da tela, única; outline = secundária) · admin: AntD `Button` (`type="primary"` idem) | Uma única ação primária por tela/etapa. Ações destrutivas com confirmação (AntD `Popconfirm`/Modal) |
| **Campos** — AntD `Input`/`Select`/`DatePicker`/`InputNumber`, `MoneyInput` p/ dinheiro | Label sempre visível (nunca placeholder-como-label); máscara em CPF/telefone; `inputMode` correto |
| **Tabelas** — AntD `Table` | Só no admin. No mobile do admin, colunas essenciais + detalhes no modal. Nunca tabela em fluxo público |
| **Cards** | Escolhas do usuário no fluxo público (ex.: sem/com camisa — cartões grandes, tocáveis, com preço explícito) e métricas no dashboard |
| **Modais** — AntD `Modal` | Fluxos sobre a página (inscrição, comprovante, CRUD admin). No mobile: altura controlada com scroll interno (quirk iOS — `docs/PLANO_ACAO_MOBILE_FIXES.md`). Máx. 1 modal sobreposto |
| **Steps/etapas** | Fluxo de inscrição (Dados → Pagamento/Confirmação). Máximo 3 etapas; rótulos de 1 palavra |
| **Navegação** | Público: header simples + âncoras. Admin: `AdminHeader`. Sem menus profundos |

## 3. Feedback e estados (obrigatórios em toda tela)

| Estado | Padrão |
|---|---|
| **Loading** | AntD `Skeleton` para conteúdo estruturado; `Spin`/loading no botão para ações. Botão de submit sempre com estado loading + disabled (evita duplo clique — crítico em pagamento) |
| **Empty** | AntD `Empty` com texto humano **e ação** ("Nenhum evento aberto no momento") |
| **Erro** | Validação: mensagem no campo (AntD Form). Ação falhou: `message.error`/`Alert` com texto acionável e caminho de recuperação. Nunca código de erro cru |
| **Sucesso** | Imediato e tangível: inscrição → comprovante na tela (`RegistrationProofModal`); ações admin → `message.success` |
| **Pendente** | Pagamento pendente tem cor própria (warning) e instrução do que acontece a seguir |

## 4. Acessibilidade (mínimos não negociáveis)

- Alvos de toque ≥ 44×44px; espaçamento entre alvos no polegar.
- Toda imagem significativa com `alt`; ícones decorativos ocultos de leitores.
- Foco visível; ordem de tabulação lógica; modais prendem o foco (AntD cobre).
- Inputs com `label` associado (AntD `Form.Item` cobre — não fugir dele).
- Não transmitir informação **só** por cor (status também em texto).
- Linguagem: português simples, frases curtas, sem jargão ("Inscrição
  confirmada!", não "Transação processada com êxito").

## 5. Responsividade

- **Mobile first**: estilos base = mobile; `md:`/`lg:` adicionam o desktop.
- Breakpoints Tailwind padrão (`sm 640 / md 768 / lg 1024 / xl 1280`).
- Testar em 360px de largura (Android comum) e no Safari iOS real — histórico
  de bugs específicos (formatação de moeda, modais) documentado em
  `docs/MELHORIAS_IOS_COMPATIBILITY.md`.
- Nada de scroll horizontal; tabelas largas do admin com scroll interno.

## 6. Evolução do design system

Ao criar/refatorar completamente uma tela: buscar referência (Stripe, Airbnb,
Linear, GOV.UK, Material 3, Apple HIG — extrair **padrões**, nunca copiar),
propor a melhoria, e se validada, **registrá-la aqui** como novo padrão oficial
na mesma entrega.
