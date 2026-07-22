Plano — Eventos Gratuitos e Formulários Dinâmicos

Contexto

Hoje todo evento exige pagamento via Mercado Pago e usa um formulário fixo (name, email, cpf, phone).
Pedido:

1.  Inscrição gratuita — admin marca isFree=true; inscrição não passa pelo MP e fica CONFIRMED direto.
2.  Formulário dinâmico opcional — admin define campos customizados na criação do evento (ex: cadastro
    para escola pede dados específicos).
3.  Modos por evento (formMode): FIXED_ONLY (atual, default), DYNAMIC_ONLY (só dinâmico), BOTH (fixo +
    dinâmico).

Decisões alinhadas com o usuário

- Colunas name/email/cpf/phone em Registration viram NULLABLE. Em DYNAMIC_ONLY, tudo vai para
  Registration.dynamicFormData: Json?.
- Novo enum value FREE em PaymentMethod.
- isFree: Boolean no Event (não derivado de price=0).
- Tipos de campo do form builder no MVP: text, textarea, number, phone (mascarado), cpf (mascarado +
  validado), select, checkbox, radio. Sem email (usar text se quiser).
- DYNAMIC_ONLY exige isFree=true (refinamento posterior do usuário). Em evento pago o formulário fixo
  é sempre obrigatório — formMode em pago só pode ser FIXED_ONLY ou BOTH. Isso preserva CPF/email/nome
  para o pipeline do Mercado Pago e dedup automática, sem refatorar a integração de pagamento.
- Edição de dynamicFormFields quando há inscrições: bloqueada (409). Admin duplica o evento se
  precisar mudar.

Arquitetura da mudança

1.  Migrations Prisma

Arquivo: prisma/schema.prisma. Comando: npx prisma migrate dev --name
add_free_events_and_dynamic_forms. SQL gerado (ordem):

ALTER TYPE "PaymentMethod" ADD VALUE 'FREE';
CREATE TYPE "EventFormMode" AS ENUM ('FIXED_ONLY', 'DYNAMIC_ONLY', 'BOTH');
ALTER TABLE "events" ADD COLUMN "isFree" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN "formMode" "EventFormMode" NOT NULL DEFAULT 'FIXED_ONLY';
ALTER TABLE "events" ADD COLUMN "dynamicFormFields" JSONB;
ALTER TABLE "registrations" ADD COLUMN "dynamicFormData" JSONB;
ALTER TABLE "registrations" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "registrations" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "registrations" ALTER COLUMN "cpf" DROP NOT NULL;
ALTER TABLE "registrations" ALTER COLUMN "phone" DROP NOT NULL;

Após: npx prisma generate. Em prod (Vercel/Supabase): npx prisma migrate deploy.

Riscos: ALTER TYPE ADD VALUE exige commit antes do uso (Prisma migrate dev lida automaticamente).
Relax de NOT NULL é seguro para linhas existentes — eventos antigos mantêm seus valores. Defaults
garantem comportamento idêntico.

2.  Schema do form dinâmico (estrutura JSON)

Novo arquivo backend/schemas/dynamicFormSchemas.ts com Zod:

type DynamicField = {
id: string; // slug [a-z0-9_]+, único no array, máx 40
label: string; // 1..120
required: boolean;
helpText?: string;
} & (
| { type: "text" | "textarea"; minLength?: number; maxLength?: number; placeholder?: string }
| { type: "number"; min?: number; max?: number; integer?: boolean }
| { type: "phone" | "cpf" }
| { type: "select" | "radio"; options: { value: string; label: string }[] } // ≥1, values únicos
| { type: "checkbox"; options: { value: string; label: string }[]; multi: boolean }
);

DynamicFormFieldsSchema = z.array(DynamicFieldSchema).max(30) com refine de id único

Tipos exportados: DynamicField, DynamicFormFields, DynamicFormData, DynamicFieldType.

3.  Validação cruzada do payload dinâmico

Novo backend/utils/dynamicFormValidator.ts com validateDynamicFormData(fields, data):

- text|textarea: string + min/maxLength + trim.
- number: número finito + min/max + (se integer) Number.isInteger.
- phone: digits-only, length 10–11.
- cpf: usa isValidCpf de utils/cpfValidator.ts; armazena digits-only.
- select|radio: valor presente em options[].value.
- checkbox multi=true: string[] ⊆ options; multi=false: boolean.
- Campos não declarados em fields são descartados.
- required=true ausente/vazio → erro com field.id no path.

Retorna { valid: true, sanitized } | { valid: false, errors: [{field, message}] }.

4.  Schema de Event (backend/schemas/eventSchemas.ts)

Adicionar a EventCreateSchema (antes dos .refine):

- isFree: z.boolean().default(false)
- formMode: z.enum(["FIXED_ONLY","DYNAMIC_ONLY","BOTH"]).default("FIXED_ONLY")
- dynamicFormFields: DynamicFormFieldsSchema.optional()

Refines extras (somar aos 3 já existentes):

- isFree=true ⇒ price === 0 (path ["price"]).
- formMode ∈ {DYNAMIC_ONLY, BOTH} ⇒ dynamicFormFields presente com ≥1 campo (path
  ["dynamicFormFields"]).
- formMode === "DYNAMIC_ONLY" ⇒ isFree === true (path ["formMode"]). Em evento pago o formulário fixo
  é obrigatório.

EventUpdateSchema continua .partial() — mas perde refines globais. Reaplicação manual em
EventController.updateEvent mesclando o payload com existingEvent antes de validar (ver §5).

5.  Backend — Controllers e endpoints

5.1 EventController (backend/controllers/EventController.ts)

createEvent:

- Após parse, se isFree=true forçar paymentConfig=null antes de persistir.
- Persistir isFree, formMode, dynamicFormFields (defaults: false / FIXED_ONLY / null).

updateEvent:

- Antes do parse, mesclar payload com existingEvent e revalidar refines críticos manualmente:
  - isFree final + price final
  - formMode final + dynamicFormFields final (≥1 campo se não FIXED_ONLY)
- Bloquear mudança em dynamicFormFields ou formMode se já existir registration com aquele evento
  (registrationRepository.count({ eventId })). Retornar 409 com mensagem clara.

  5.2 Novo endpoint público POST /api/registrations/create-free

Arquivo app/api/registrations/create-free/route.ts. Schema Zod local:

{
eventId: string,
fixedData?: { name, email, cpf, phone }, // obrigatório se formMode ∈ {FIXED_ONLY, BOTH}
dynamicFormData?: Record<string, unknown> // obrigatório se formMode ∈ {DYNAMIC_ONLY, BOTH}
}

Fluxo (todas operações via withPrismaRetry):

1.  Buscar evento com \_count.registrations.
2.  Validar: existe, isActive, vagas disponíveis, dentro da janela registrationStart/EndDate.
3.  Bloqueio crítico: if (!event.isFree) return 400 (evita uso indevido para fraudar pagamento).
4.  Validar combinação formMode × payload:

- FIXED_ONLY: exigir fixedData. Validar com registrationSchema. Dedup por cpf+eventId.
- DYNAMIC_ONLY: exigir dynamicFormData. Validar via validateDynamicFormData(event.dynamicFormFields,
  dynamicFormData). Sem dedup (limitação MVP).
- BOTH: exigir ambos. Dedup por CPF.

5.  Criar registration:

- status: "CONFIRMED", paymentMethod: "FREE".
- paymentId: \free*${Date.now()}*${random}`` (rastreável em logs, não-null).
- name/email/cpf/phone do fixedData ou null.
- dynamicFormData sanitizado ou null.

6.  Retornar { success: true, registration: { id, status, eventTitle } } + dados pro
    RegistrationProofModal.

5.3 POST /api/payments/create-preference — ajustes

app/api/payments/create-preference/route.ts:

- Bloquear event.isFree=true (400 "Use /api/registrations/create-free").
- Se event.formMode === "BOTH" (único caso dinâmico em evento pago):
  - Estender schema da rota para aceitar dynamicFormData (obrigatório em BOTH).
  - Validar com validateDynamicFormData antes de criar Preference.
  - Persistir em prisma.registration.create/update({ data: { dynamicFormData, ... } }) lado a lado com
    os campos fixos atuais.
- participantData continua obrigatório em qualquer evento pago — pipeline do MP, payer e dedup por CPF
  permanecem intactos. formMode === "DYNAMIC_ONLY" em evento pago já é bloqueado pelo refine do schema;
  defensivamente retornar 400 caso passe (proteção em profundidade).

  5.4 POST /api/admin/registrations/manual — ajustes

app/api/admin/registrations/manual/route.ts:

- Aceitar dynamicFormData opcional no body.
- Tornar participantData opcional quando event.formMode === DYNAMIC_ONLY.
- Validar dynamicFormData via validateDynamicFormData.
- Setar name/email/cpf/phone como null em DYNAMIC_ONLY.
- Não mexer no resto da rota (já em produção).

Observação fora-de-escopo: essa rota não usa withPrismaRetry e não seta paymentMethod=MANUAL
explicitamente (cai no default MERCADO_PAGO do schema — bug latente, não-bloqueador). Marcar como
follow-up.

5.5 GET /api/events/active

app/api/events/active/route.ts: adicionar isFree, formMode, dynamicFormFields ao response.

5.6 POST /api/registrations/get-by-id

app/api/registrations/get-by-id/route.ts: incluir dynamicFormData + event.formMode +
event.dynamicFormFields na resposta para o RegistrationProofModal renderizar.

6.  Frontend admin — components/admin/EventModal.tsx

Novos Form.Items (Ant Design):

- name="isFree" valuePropName="checked" — <Switch checkedChildren="Gratuito" unCheckedChildren="Pago"
  />.
- name="formMode" — <Radio.Group> 3 opções.
- name="dynamicFormFields" — controlado, padrão PaymentConfigForm:
  <DynamicFormBuilder
  value={form.getFieldValue("dynamicFormFields")}
  onChange={(fields) => form.setFieldsValue({ dynamicFormFields: fields })}
  />

Comportamento condicional (Form.useWatch):

- isFree=true → MoneyInput desabilitado, valor 0; PaymentConfigForm oculto.
- formMode === "FIXED_ONLY" → ocultar DynamicFormBuilder.
- isFree=false (pago) → opção DYNAMIC_ONLY é desabilitada/oculta no Radio.Group de formMode (em evento
  pago só FIXED_ONLY ou BOTH são selecionáveis). Se admin alterna isFree true→false e o formMode atual
  era DYNAMIC_ONLY, forçar volta para BOTH (ou FIXED_ONLY se dynamicFormFields vazio).

Atualizar interface Event local + useEventValidation (hooks/useEventValidation.ts) com os 3 novos
campos.

Novo componente components/admin/DynamicFormBuilder.tsx

Props: { value?: DynamicField[], onChange: (fields) => void, disabled?: boolean }.

Estrutura:

- Lista de cards (não usa Form.List do AntD para evitar acoplar com Form pai).
- Cada card: Select para type (8 opções), Input label, Input id (auto-slug do label via slugUtils),
  Switch required, Input helpText.
- Painel condicional por tipo (text/textarea: min/maxLength + placeholder; number: min/max + integer;
  select/radio/checkbox: lista editável de options).
- Botões por card: mover ↑↓, duplicar, remover.
- Botão "+ Adicionar campo" no rodapé.
- Validações locais inline: id duplicado, options vazias, etc.

7.  Frontend público — components/event/EventRegistrationModal.tsx

7.1 Novo componente components/registration/DynamicFormRenderer.tsx

Decisão: Ant Design Form (consistência com RegistrationForm e EventModal/DynamicFormBuilder).

Props:
{
fields: DynamicField[];
form: FormInstance;
loading: boolean;
disabled?: boolean;
hideButtons?: boolean; // true em BOTH (botões pelo modal pai)
submitLabel?: string;
onSubmit?: (data: Record<string, unknown>) => Promise<void>;
}

Mapa tipo → AntD: text→Input, textarea→Input.TextArea, number→InputNumber, phone/cpf→Input com
formatadores existentes, select→Select, radio→Radio.Group, checkbox multi→Checkbox.Group,
single→Checkbox.

Cada Form.Item usa name={["dynamicFormData", field.id]} para que form.getFieldsValue() retorne {
dynamicFormData: {...} } direto.

7.2 Mudanças em EventRegistrationModal.tsx

Adicionar ao tipo Event local: isFree, formMode, dynamicFormFields.

Flags computados:
const isFreeFlow = !!event.isFree;
const showFixed = formMode !== "DYNAMIC_ONLY";
const showDynamic = formMode !== "FIXED_ONLY";

Steps dinâmicos:

- isFreeFlow=true: 2 etapas (dados → confirmar).
- Pago: 3 etapas atuais (ou 2 se isUpdatingPayment).

Etapa 0 (dados):

- FIXED_ONLY: RegistrationForm (sem mudanças).
- DYNAMIC_ONLY (somente em evento gratuito por refine): DynamicFormRenderer apenas. useCpfVerification
  desligado — sem ExistingRegistrationAlert.
- BOTH: RegistrationForm (sem botão de submit, hideButtons=true) + DynamicFormRenderer (sem botão),
  ambos amarrados ao mesmo form. Submit pelo modal pai via form.validateFields(). Em evento pago BOTH,
  useCpfVerification continua ativo (CPF está no fixo).

Submit:

- isFreeFlow: pular método de pagamento. Botão "Finalizar Inscrição" → POST
  /api/registrations/create-free com { eventId, fixedData?, dynamicFormData? }. Sucesso: abrir
  RegistrationProofModal direto (sem redirect).
- Pago + formMode === "BOTH": anexar dynamicFormData à chamada existente de
  /api/payments/create-preference (que já recebe participantData fixo). Pipeline do MP intacto.

Estado interno passa de formData: RegistrationFormData | null para formData: { fixed?:
RegistrationFormData; dynamic?: Record<string,unknown> } | null.

7.3 RegistrationForm.tsx

Adicionar props opcionais submitLabel?: string e hideButtons?: boolean. Sem outras mudanças — continua
sendo o "form fixo" usado em FIXED_ONLY/BOTH.

7.4 EventDisplay.tsx (home)

Exibir badge "Gratuito" quando isFree=true (substitui ou complementa o display de preço).

8.  Comprovante e admin de inscrições

- RegistrationProofModal.tsx: tolerar name/cpf/email/phone null; quando dynamicFormFields presente,
  iterar sobre eles e renderizar label → valor formatado na seção Descriptions. Para checkbox múltiplo,
  juntar com vírgula. Para cpf/phone, formatar.
- ManualRegistrationModal.tsx (admin): embutir DynamicFormRenderer quando event.formMode !=
  FIXED_ONLY; em DYNAMIC_ONLY, não exigir participantData.
- RegistrationTable.tsx (admin): coluna "Respostas dinâmicas" só visível quando event.formMode !=
  FIXED_ONLY, com tooltip listando todas as respostas. Filtros por nome/email viram no-op em
  DYNAMIC_ONLY (aceitar).
- /checkin: documentar que DYNAMIC_ONLY sem CPF não é suportado pela busca atual. Follow-up: busca
  alternativa por id/QR. Não-bloqueador.

9.  Tipos TS após prisma generate

Após o relax de NOT NULL, Registration.name/email/cpf/phone viram string | null. O compilador vai
apontar lugares no código atual:

- app/api/registrations/get-by-id/route.ts (já permissivo no JSON).
- RegistrationProofModal.tsx.
- RegistrationTable.tsx / RegistrationFilters.tsx.
- app/api/registrations/[id]/route.ts.
- components/admin/registrations/\*.

Cada um aceita fallback (?? "" ou exibição condicional). Esperado: 5–15 ajustes pontuais.

Arquivos a tocar (ordem de implementação)

1.  prisma/schema.prisma — novos enums, campos e relax NOT NULL.
2.  prisma/migrations/<ts>\_add_free_events_and_dynamic_forms/migration.sql — gerada pelo Prisma;
    revisar SQL.
3.  backend/schemas/dynamicFormSchemas.ts (novo) — schemas Zod e tipos.
4.  backend/utils/dynamicFormValidator.ts (novo) — validateDynamicFormData.
5.  backend/schemas/eventSchemas.ts — incluir 3 campos novos + 2 refines.
6.  backend/controllers/EventController.ts — propagar campos; checagem de count antes de mudar form;
    reaplicar refines no update.
7.  backend/repositories/RegistrationRepository.ts — defesas para CPF/email nulos; tipos pós-generate.
8.  app/api/registrations/create-free/route.ts (novo) — endpoint público gratuito.
9.  app/api/payments/create-preference/route.ts — bloquear isFree; aceitar dynamicFormData; suportar
    DYNAMIC_ONLY pago com payer fallback.
10. app/api/admin/registrations/manual/route.ts — aceitar dynamicFormData; tornar participantData
    opcional em DYNAMIC_ONLY.
11. app/api/events/active/route.ts — expor 3 campos novos.
12. app/api/registrations/get-by-id/route.ts — incluir dynamicFormData +
    event.formMode/dynamicFormFields.
13. types/event.ts — interface Event ganha 3 campos.
14. hooks/useEventValidation.ts — EventFormData ganha 3 campos.
15. components/admin/DynamicFormBuilder.tsx (novo) — form builder.
16. components/admin/EventModal.tsx — Form.Items para isFree/formMode/dynamicFormFields;
    condicionalidade.
17. components/registration/DynamicFormRenderer.tsx (novo) — renderiza form dinâmico para o público.
18. components/registration/RegistrationForm.tsx — props submitLabel/hideButtons.
19. components/event/EventRegistrationModal.tsx — lógica de steps (free/paid × FIXED/DYNAMIC/BOTH);
    endpoint condicional; useCpfVerification condicional.
20. components/RegistrationProofModal.tsx — renderizar dynamicFormData; tolerar nulls.
21. components/admin/registrations/RegistrationModal.tsx — embutir DynamicFormRenderer quando
    aplicável.
22. components/admin/registrations/RegistrationTable.tsx — coluna "Respostas dinâmicas".
23. components/event/EventDisplay.tsx — badge "Gratuito".

Verificação manual end-to-end

Executar nesta ordem:

1.  Regressão pago FIXED_ONLY — criar evento normal, inscrever via fluxo de 3 etapas, checkout MP,
    Executar nesta ordem:
    1.  Regressão pago FIXED_ONLY — criar evento normal, inscrever via fluxo de 3 etapas, checkout MP,
        success. Esperado: idêntico ao atual.
    2.  Gratuito FIXED_ONLY — admin com isFree=true, FIXED_ONLY. Modal público com 2 etapas, sem
        PaymentMethodSelector. POST /create-free cria CONFIRMED + paymentMethod=FREE. Tentar reinscrever
        mesmo CPF → 409.
    3.  Gratuito DYNAMIC_ONLY — admin define 3 campos (text "Igreja", select "Faixa etária", checkbox
        múltiplo "Interesses"). Modal público sem CPF/ExistingRegistrationAlert. Submit cria registration
        com nulls e dynamicFormData. Painel admin lista mostrando os campos.
    4.  Gratuito BOTH — fixos + 2 dinâmicos. Dedup por CPF funciona; comprovante mostra ambos.
    5.  Pago BOTH — 3 etapas, fixo + dinâmico no step 0; dynamicFormData persiste junto com a
        Preference; checkout MP igual ao atual; webhook atualiza para CONFIRMED.
    6.  Validação cruzada:
    - POST /create-free em evento isFree=false → 400.
    - Criar evento formMode=BOTH sem dynamicFormFields → 422.
    - Criar evento formMode=DYNAMIC_ONLY + isFree=false → 422 (refine).
    - Editar dynamicFormFields de evento com inscrições → 409.
    - Editar formMode de evento com inscrições → 409.
    - Tentar POST /create-preference em evento formMode=DYNAMIC_ONLY (rota não deve aceitar) → 400
      defensivo.
    Riscos e pontos de atenção
    1.  DYNAMIC_ONLY sem CPF (somente em gratuito): zero dedup automática — usuário pode se inscrever
        2x. Aceitável em gratuito (sem custo). Documentar na UI do admin (alerta ao salvar evento  
        DYNAMIC_ONLY).
    2.  /checkin por CPF quebra em DYNAMIC_ONLY. Follow-up: busca por id da inscrição (QR code já contém
        registration.id).
    3.  Migration NOT NULL → NULL é praticamente irreversível depois que linhas com null forem
        inseridas. Backup recomendado antes do deploy.
    4.  Refines no update parcial: EventUpdateSchema.partial() perde refines globais — reaplicar
        manualmente em EventController.updateEvent mesclando com existingEvent. Caso contrário admin pode
        quebrar regras editando (ex: alternar isFree para false sem voltar formMode de DYNAMIC_ONLY).
    5.  Edição de dynamicFormFields com inscrições: bloquear no admin (UI desabilita o builder +  
        mensagem clara) E no backend (409 defensivo).
    6.  select/radio/checkbox revalidados no submit contra options vigentes do evento (não cachear no  
        cliente).
    7.  ALTER TYPE ADD VALUE FREE: precisa commitar antes do uso; Prisma migrate dev lida; em produção
        monitorar logs.
    8.  ExistingRegistrationAlert em BOTH com inscrição prévia gratuita: ajustar para mostrar "Você já
        está inscrito — ver comprovante" sem botão de pagamento.
    9.  Update de Registration em fluxo MP retry (CANCELLED/PAYMENT_FAILED → PENDING) precisa preservar
        dynamicFormData antigo se não vier no body novo.
    10. Follow-up fora do escopo: rota /api/admin/registrations/manual não usa withPrismaRetry e não
        seta paymentMethod=MANUAL explicitamente (cai em default MERCADO_PAGO). Bug latente — registrar
        issue separada.
