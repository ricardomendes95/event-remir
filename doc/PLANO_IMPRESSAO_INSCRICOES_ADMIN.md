# Plano — Impressão da lista de inscrições no admin

## Objetivo

Adicionar um botão "Imprimir Lista" na página `/admin/registrations` que gera um relatório imprimível da lista de inscrições do evento selecionado no filtro de evento, seguindo o mesmo padrão visual e técnico do relatório de check-in (`/checkin`), com a diferença de que **os valores dos campos dinâmicos de cada inscrição devem aparecer como colunas extras** na tabela impressa.

---

## Referência: como funciona o checkin

A rota `/checkin` serve de modelo completo:

1. `handleExportForPrint()` → chama `GET /api/registrations/export?eventId=X`
2. O endpoint retorna `{ event, registrations, stats, exportedAt }`
3. Os dados ficam em `exportData` no estado
4. Um `<Modal>` exibe `<CheckinReportPrint data={exportData} />` como preview
5. `handlePrint()` abre `window.open("", "_blank")`, escreve HTML inline e chama `printWindow.print()`
6. Também há exportação CSV via `handleExportToCSV()`

**Diferença-chave para inscrições**: precisamos incluir `dynamicFormFields` do evento (definições dos campos) e `dynamicFormData` de cada inscrição (respostas), além de mostrar todos os status (não apenas CONFIRMED).

---

## Análise das lacunas

| Item | Checkin | Inscrições (a implementar) |
|------|---------|---------------------------|
| Endpoint de export | `/api/registrations/export` — só CONFIRMED, sem campos dinâmicos | Novo endpoint: todos os status + campos dinâmicos |
| Componente de preview | `CheckinReportPrint` | Novo `RegistrationsPrintReport` |
| Colunas da tabela | Nome, Email, CPF, Tel, Status check-in, Data check-in, Assinatura | Nome, Email, CPF, Tel, Status inscrição, Data inscrição + colunas dinâmicas |
| Botão de ação | Em `/checkin/page.tsx` | Em `RegistrationTable` (prop `onPrint`) |
| Restrição | Exige `selectedEvent` | Desabilitado quando `eventFilter === "ALL"` |

---

## Arquivos a criar / modificar

### 1. `app/api/registrations/export-admin/route.ts` — CRIAR

Novo endpoint `GET /api/registrations/export-admin?eventId=X&status=ALL`.

```
Parâmetros de query:
  eventId  (obrigatório) — ID do evento
  status   (opcional, default "ALL") — CONFIRMED | PENDING | CANCELLED | PAYMENT_FAILED | ALL

Resposta:
  {
    success: true,
    data: {
      event: {
        id, title, description, price, startDate, endDate, location,
        dynamicFormFields   ← Array<DynamicField> do evento (ou [])
      },
      registrations: Array<{
        id, name, email, cpf, phone, status, paymentMethod,
        createdAt, checkedInAt?,
        dynamicFormData: Record<string, unknown>  ← campos dinâmicos preenchidos
      }>,
      stats: { total, confirmed, pending, cancelled, paymentFailed, totalRevenue },
      exportedAt: string
    }
  }
```

Implementação:
- `prisma.event.findUnique({ where: { id: eventId }, select: { ...campos + dynamicFormFields } })`
- `prisma.registration.findMany({ where: { eventId, ...(status !== "ALL" ? { status } : {}) }, orderBy: { name: "asc" } })`
- Incluir `dynamicFormData` no select (campo Json do modelo Registration)
- Calcular stats agrupando por status
- Adicionar a rota ao `publicRoutes` do middleware **não** — esta rota fica protegida pois está sob `/api/registrations/*`; o middleware já a protege automaticamente

### 2. `components/admin/RegistrationsPrintReport.tsx` — CRIAR

Componente React para preview de impressão. Segue a mesma estrutura do `CheckinReportPrint` com adaptações:

**Cabeçalho**: "LISTA DE INSCRIÇÕES" + título do evento + local + data.

**Estatísticas** (cards):
- Total de inscrições
- Confirmadas
- Pendentes
- Canceladas / Pagamento falho (se houver)

**Tabela de participantes**:

Colunas fixas:
```
# | Nome | Email | CPF | Telefone | Status | Data de inscrição
```

Colunas dinâmicas (uma por campo em `event.dynamicFormFields`):
```
| {field.label} |
```
Para cada registro, o valor é `dynamicFormData[field.id]`, formatado:
- `string` → valor direto
- `Array<string>` → join(", ") (checkboxes)
- `null | undefined` → "—"

**Rodapé**: receita total (se evento pago) + linha de assinatura do responsável.

**Props**:
```typescript
interface RegistrationsPrintReportProps {
  data: {
    event: {
      id: string; title: string; location?: string;
      startDate: string; endDate?: string; price: number;
      dynamicFormFields: DynamicField[];
    };
    registrations: Array<{
      id: string; name: string; email?: string; cpf: string;
      phone?: string; status: string; createdAt: string;
      dynamicFormData: Record<string, unknown>;
    }>;
    stats: { total: number; confirmed: number; pending: number; cancelled: number; paymentFailed: number; totalRevenue: number; };
    exportedAt: string;
  };
}
```

**Renderização das colunas dinâmicas**:
```tsx
// Montar lista de campos dinâmicos do evento
const dynamicFields = data.event.dynamicFormFields ?? [];

// No <thead>:
{dynamicFields.map(field => <th key={field.id}>{field.label}</th>)}

// Por linha de registration:
{dynamicFields.map(field => {
  const val = reg.dynamicFormData?.[field.id];
  const display = Array.isArray(val) ? val.join(", ") : String(val ?? "—");
  return <td key={field.id}>{display}</td>;
})}
```

### 3. `components/admin/registrations/RegistrationTable.tsx` — MODIFICAR

Adicionar prop `onPrint` e o botão "Imprimir Lista":

```typescript
interface RegistrationTableProps {
  // ...props existentes...
  onPrint?: () => void;
  isPrinting?: boolean;
  printDisabled?: boolean;  // true quando eventFilter === "ALL"
}
```

No JSX, junto ao botão "Nova Inscrição", adicionar:
```tsx
<Button
  icon={<PrinterOutlined />}
  onClick={onPrint}
  loading={isPrinting}
  disabled={printDisabled}
  title={printDisabled ? "Selecione um evento específico para imprimir" : "Imprimir lista"}
>
  Imprimir Lista
</Button>
```

Importar `PrinterOutlined` de `@ant-design/icons`.

### 4. `components/admin/registrations/index.ts` — NÃO MODIFICAR

`RegistrationsPrintReport` não precisa ser exportado daqui — será importado diretamente em `page.tsx`.

### 5. `app/admin/registrations/page.tsx` — MODIFICAR

Adicionar os estados e funções de impressão, espelhando o padrão do `/checkin`:

**Estados a adicionar**:
```typescript
const [isPrinting, setIsPrinting] = useState(false);
const [printData, setPrintData] = useState<PrintData | null>(null);
const [showPrintModal, setShowPrintModal] = useState(false);
```

**Função `handlePrint` (busca dados + abre modal)**:
```typescript
const handlePrint = async () => {
  if (!eventFilter || eventFilter === "ALL") {
    message.warning("Selecione um evento específico para imprimir");
    return;
  }
  setIsPrinting(true);
  try {
    const params = new URLSearchParams({ eventId: eventFilter });
    if (statusFilter !== "ALL") params.append("status", statusFilter);

    const response = await fetch(`/api/registrations/export-admin?${params}`);
    const data = await response.json();
    if (data.success) {
      setPrintData(data.data);
      setShowPrintModal(true);
    } else {
      message.error(data.error || "Erro ao gerar relatório");
    }
  } catch {
    message.error("Erro ao gerar relatório");
  } finally {
    setIsPrinting(false);
  }
};
```

**Função `handleDoPrint` (abre janela de impressão)**:
```typescript
const handleDoPrint = () => {
  if (!printData) return;
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(buildPrintHtml(printData));
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }
};
```

`buildPrintHtml(data)` é uma função auxiliar que gera o HTML de impressão inline (mesma técnica do checkin). Ela deve:
- Incluir a tabela com colunas fixas + colunas dinâmicas
- Montar cabeçalhos das colunas dinâmicas com `data.event.dynamicFormFields.map(f => `<th>${f.label}</th>``)`
- Para cada registro, renderizar `data.event.dynamicFormFields.map(f => ...)` com os valores de `reg.dynamicFormData`

**Passar props ao `<RegistrationTable>`**:
```tsx
<RegistrationTable
  // ...props existentes...
  onPrint={handlePrint}
  isPrinting={isPrinting}
  printDisabled={!eventFilter || eventFilter === "ALL"}
/>
```

**Modal de preview**:
```tsx
<Modal
  title="Lista de Inscrições"
  open={showPrintModal}
  onCancel={() => setShowPrintModal(false)}
  width="90%"
  style={{ top: 20 }}
  footer={[
    <Button key="cancel" onClick={() => setShowPrintModal(false)}>Cancelar</Button>,
    <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handleDoPrint}>
      Imprimir
    </Button>,
  ]}
>
  {printData && <RegistrationsPrintReport data={printData} />}
</Modal>
```

---

## Fluxo completo

```
Admin clica "Imprimir Lista"
  ↓
handlePrint() — verifica eventFilter !== "ALL"
  ↓
GET /api/registrations/export-admin?eventId=X[&status=Y]
  ↓ (retorna evento + inscrições + dynamicFormFields + dynamicFormData)
setPrintData(data) + setShowPrintModal(true)
  ↓
Modal abre com <RegistrationsPrintReport> mostrando preview
  ↓
Admin clica "Imprimir"
  ↓
handleDoPrint() → window.open → document.write(HTML) → printWindow.print()
```

---

## Comportamento dos campos dinâmicos na impressão

| Tipo de campo | Valor em dynamicFormData | Exibição na tabela |
|--------------|--------------------------|-------------------|
| text / textarea | `"string"` | string direta |
| number | `42` | `"42"` |
| select | `"opção A"` | `"opção A"` |
| checkbox | `["A", "B"]` | `"A, B"` |
| radio | `"opção"` | `"opção"` |
| date | `"2026-05-03"` | `"2026-05-03"` |
| ausente / null | `undefined` ou `null` | `"—"` |

---

## Diferenças em relação ao relatório de check-in

| Aspecto | Check-in (`/checkin`) | Inscrições (`/admin/registrations`) |
|---------|----------------------|--------------------------------------|
| Título do relatório | "RELATÓRIO DE CHECK-IN" | "LISTA DE INSCRIÇÕES" |
| Status incluídos | Apenas CONFIRMED | Todos (ou filtrado) |
| Coluna check-in | Sim (presente/aguardando + horário) | Não |
| Coluna assinatura | Sim (espaço em branco) | Não |
| Coluna status | Não | Sim (Confirmado / Pendente / etc.) |
| Campos dinâmicos | Não | Sim (colunas extras) |
| Receita no rodapé | Sim | Apenas se evento pago |

---

## Restrições e edge cases

1. **eventFilter === "ALL"**: botão desabilitado com tooltip explicativo
2. **Evento sem campos dinâmicos** (`dynamicFormFields = []`): nenhuma coluna extra aparece — a tabela fica igual ao modelo checkin sem a coluna assinatura
3. **Registro sem `dynamicFormData`** (inscrições antigas ou FIXED_ONLY): exibir `"—"` em todas as colunas dinâmicas
4. **Muitas colunas dinâmicas**: a tabela pode ficar larga; usar `font-size: 10px` e `@media print { body { font-size: 9px } }` para compensar
5. **Evento gratuito**: não mostrar "Receita Total" no rodapé (ou mostrar R$ 0,00)
6. **statusFilter aplicado**: o fetch de `export-admin` respeita o statusFilter atual para que o admin imprima exatamente o que está vendo na tela

---

## Verificação após implementação

- [ ] Botão "Imprimir Lista" aparece em `RegistrationTable`
- [ ] Botão desabilitado quando filtro de evento é "Todos"
- [ ] Clique abre modal com preview da lista
- [ ] Evento sem campos dinâmicos: tabela só com colunas fixas
- [ ] Evento com campos dinâmicos (BOTH): colunas extras aparecem com labels corretos
- [ ] Valores de checkbox (array) aparecem como "A, B, C"
- [ ] Inscrições sem dynamicFormData exibem "—" nas colunas dinâmicas
- [ ] Botão "Imprimir" no modal abre `window.open` e dispara `print()`
- [ ] `npx tsc --noEmit` sem erros
- [ ] `npm run build` sem erros
