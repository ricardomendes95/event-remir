# 06 — Princípios de UX

Normativo. Este projeto tem foco extremo em usabilidade: o público inclui
pessoas com pouca experiência em tecnologia, e **cada clique desnecessário é
uma possível desistência de inscrição**.

## 1. Regra oficial: Mobile First

**Toda tela nasce mobile. A versão desktop é consequência.**

- Nunca adaptar um layout desktop para mobile; desenhar primeiro a experiência
  no telefone (o tráfego real vem de links no WhatsApp/Instagram).
- Considerar sempre: zona do **polegar** (ações principais na metade inferior),
  áreas de toque ≥ 44px, contraste sob luz solar, **teclado virtual** (correto
  por tipo de campo, e que não cubra o campo ativo), conexões lentas (3G),
  navegadores **embutidos** de apps (limitações de redirect — já tratadas por
  `useDeviceDetection` + `redirectToPayment` + `EmbeddedBrowserWarningModal`).
- Testar no Safari iOS real: histórico de quirks documentado em
  `docs/MELHORIAS_IOS_COMPATIBILITY.md` e `docs/PLANO_ACAO_MOBILE_FIXES.md`.

## 2. Princípios de decisão

Diante de qualquer escolha de UX, perguntar sempre:
**Existe uma forma mais simples? Mais intuitiva? Mais rápida?**

1. **Menos é conversão** — menos cliques, menos telas, menos campos. Todo campo
   novo no fluxo público precisa justificar seu custo em desistência (por isso
   e-mail/telefone são configuráveis em evento gratuito).
2. **Linguagem do usuário** — "Ir para o pagamento", "Inscrição confirmada!".
   Nunca termos de sistema ("preferência", "gateway", "transação").
3. **Feedback imediato** — toda ação responde em <1s com algo visível (loading
   no botão, validação no campo ao sair dele, máscara enquanto digita).
4. **Confiança** — mostrar o valor total antes de cobrar; comprovante imediato
   e recuperável (busca por CPF); nome da igreja/evento visível no fluxo.
5. **Nunca perder o trabalho do usuário** — exemplo canônico: "continuar
   pagamento" reaproveita a inscrição PENDING em vez de fazer o usuário
   redigitar tudo. Features novas devem preservar esse princípio (estado
   recuperável > formulário zerado).
6. **Prevenir > corrigir** — validação inline antes do submit; dedup de CPF
   detectada na digitação, não no erro final; botões desabilitados com motivo
   visível quando a ação não é possível.
7. **Um caminho feliz óbvio** — uma ação primária por etapa; secundárias
   discretas; sem becos sem saída (todo erro oferece próximo passo).

## 3. Anatomia do fluxo público (padrão a preservar)

- Máximo **2–3 etapas** com indicador de progresso.
- Etapa 1 concentra a digitação; etapas seguintes são escolha/confirmação.
- Escolhas apresentadas como **cartões tocáveis com preço explícito** (padrão
  camisa), não dropdowns escondidos.
- Encerramento sempre com comprovante visível e instrução do que vem depois.

## 4. Inspiração obrigatória

Ao criar uma tela nova ou refatorar completamente uma existente, analisar
referências modernas **para extrair padrões** (organização, hierarquia,
espaçamento, formulários, etapas, navegação, feedback, estados,
acessibilidade) — nunca copiar interfaces:

Airbnb · Stripe · Notion · Shopify · Linear · Apple HIG · Material Design 3 ·
Ant Design · Vercel Dashboard · **GOV.UK Design System** (referência máxima de
clareza e acessibilidade para público leigo — a mais alinhada a este produto).

## 5. Evolução contínua

A documentação representa o estado **atual**, não o ideal. Ao tocar uma tela,
avaliar oportunidades de melhoria em UX, UI, conversão, acessibilidade,
consistência, performance e reutilização. Melhoria validada → vira padrão
oficial → atualizar `05_DESIGN_SYSTEM.md` (e este documento, se for princípio).

## 6. Métricas mentais de sucesso

- Inscrição completa em **menos de 60 segundos** no mobile, na primeira
  tentativa, por alguém que nunca viu o sistema.
- Zero perguntas do tipo "onde clico?" — se um voluntário da igreja precisa
  explicar a tela, a tela falhou.
- Taxa de abandono entre "abrir modal" e "concluir" deve cair a cada release
  que toque o fluxo (usar `PageView`/dashboard como proxy até haver métrica
  dedicada).
