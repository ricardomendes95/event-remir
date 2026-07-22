# Viabilidade: Notificação WhatsApp pós-inscrição via Baileys

## Contexto e objetivo

O sistema event-remir confirma inscrições em eventos (gratuitos e pagos) mas não envia nenhuma notificação ao inscrito após a confirmação. A proposta é disparar automaticamente uma mensagem de WhatsApp para o número do inscrito assim que a inscrição for confirmada, contendo o link do grupo do evento.

**Gatilhos previstos:**

- Inscrição confirmada em evento gratuito — `app/api/registrations/create-free/route.ts`
- Pagamento aprovado pelo Mercado Pago — `app/api/payments/webhook/route.ts:335` (há um `TODO` explícito nesse ponto)

---

## Estado atual do sistema

O projeto já possui os elementos de dados necessários:

| Item                      | Status           | Detalhe                                             |
| ------------------------- | ---------------- | --------------------------------------------------- |
| `Registration.phone`      | ✅ Existe        | Campo opcional no schema — será o número de destino |
| `Event.whatsappGroupLink` | ❌ Não existe    | Precisa ser adicionado ao schema                    |
| Sistema de notificações   | ❌ Não existe    | TODO em `webhook/route.ts:335`, nada implementado   |
| Biblioteca de mensageria  | ❌ Não instalada | Apenas Mercado Pago no `package.json`               |

O `TODO` no webhook documenta exatamente onde a notificação deve ser inserida:

```typescript
// app/api/payments/webhook/route.ts:335-339
// TODO: Enviar email de confirmação se aprovado
if (newStatus === "CONFIRMED") {
  console.log(`Pagamento aprovado para ${registration.email}`);
  // Aqui seria implementado o envio de email
}
```

---

## O que é Baileys

[`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys) é uma biblioteca Node.js de código aberto que implementa o protocolo do WhatsApp Web via WebSocket. Não usa a API oficial do WhatsApp Business e não tem custo por mensagem.

**Funcionamento:** na primeira execução, exibe um QR code para escanear com o WhatsApp do número remetente. Após autenticação, a sessão é salva em disco e reutilizada automaticamente. O servidor mantém uma conexão WebSocket ativa e envia mensagens através dela.

---

## Problema crítico: Serverless vs. conexão persistente

**Este é o principal obstáculo técnico.**

O projeto roda na Vercel com o modelo serverless (funções efêmeras). Cada requisição inicia uma nova instância de função que termina logo após a resposta. Não há processo persistente nem sistema de arquivos durável entre invocações.

Baileys exige exatamente o oposto:

- Conexão WebSocket contínua (processo Node.js rodando 24/7)
- Estado de sessão salvo em disco entre reinicializações (`auth_info_baileys/`)
- Reconexão automática quando a conexão cai

**Conclusão: Baileys não pode rodar diretamente dentro de uma função Vercel.**

---

## Solução adotada: microserviço WhatsApp no Fly.io

Um servidor Node.js dedicado mantém a conexão Baileys ativa e expõe uma API HTTP interna. O projeto principal (Vercel) chama essa API para solicitar envios. O painel admin do event-remir é a **interface de gerenciamento** do microserviço — o administrador nunca precisará acessar o servidor diretamente.

```
┌──────────────────────────────────┐    HTTP    ┌─────────────────────────────┐
│   Vercel (event-remir)           │ ─────────► │  Microserviço (Fly.io)      │
│                                  │            │                             │
│  webhook/route.ts (pós-pagto)    │            │  POST /send-message         │
│  create-free/route.ts (gratuito) │            │  GET  /status               │
│  Admin: página WhatsApp Settings │ ◄───────── │  GET  /qrcode               │
└──────────────────────────────────┘            │                             │
                                                │  Baileys ──► WhatsApp Web   │
                                                └─────────────────────────────┘
```

**Por que Fly.io:**
- Free tier inclui 3 VMs sempre ligadas (sem "dormir")
- 1GB de disco persistente gratuito — necessário para salvar a sessão do Baileys
- Deploy via CLI em minutos
- Volume de 10–150 inscrições/mês fica muito abaixo dos limites gratuitos

---

## O admin como interface de configuração do microserviço

O administrador nunca precisará abrir um terminal ou acessar o servidor. Toda a operação será feita pela tela **Configurações → WhatsApp** no painel admin do event-remir.

### Tela: WhatsApp Settings (`/admin/settings/whatsapp`)

**Estado: desconectado (primeira vez ou após expiração)**
- Card de status vermelho: "WhatsApp desconectado"
- Exibe o QR code retornado pelo endpoint `GET /qrcode` do microserviço
- Instrução: "Abra o WhatsApp no celular dedicado > Aparelhos conectados > Conectar aparelho > escaneie este código"
- QR code atualiza automaticamente (polling a cada 30s enquanto desconectado)

**Estado: conectado**
- Card de status verde: "WhatsApp conectado — número: +55 11 99999-9999"
- Botão "Desconectar" (chama `POST /disconnect` no microserviço)
- Botão "Enviar mensagem de teste" — modal com campo de número e texto

**Configuração do link do grupo por evento:**
- Campo "Link do grupo WhatsApp" já presente no formulário de criação/edição de evento
- Quando preenchido, inscrições confirmadas naquele evento disparam a mensagem automaticamente

---

## O que você precisa fazer manualmente (passo a passo)

> Estas etapas não podem ser automatizadas pelo agente IA. São ações que exigem acesso humano a contas, dispositivos e aprovações externas.

### Etapa 1 — Número de WhatsApp dedicado

1. Separe um chip/número de telefone exclusivo para o sistema. **Não use seu número pessoal** — esse número ficará "preso" como remetente automatizado e não poderá ser usado normalmente no WhatsApp.
2. Instale o WhatsApp nesse número (pode ser em um celular antigo, chip virtual, ou eSIM).
3. Anote o número completo com DDD (ex: `11 98765-4321`).

### Etapa 2 — Criar conta no Fly.io

1. Acesse [fly.io](https://fly.io) e clique em **Sign Up**
2. Crie conta com e-mail e senha (não é necessário cartão de crédito para o free tier)
3. Confirme o e-mail recebido

### Etapa 3 — Instalar o flyctl (CLI do Fly.io)

No terminal da sua máquina:

```bash
# Linux / macOS
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex
```

Após instalar, faça login:

```bash
fly auth login
# Abre o navegador — authorize o acesso
```

### Etapa 4 — Implantar o microserviço

O agente IA criará o repositório `whatsapp-sender/` com todos os arquivos. Depois que ele terminar, você executa:

```bash
cd whatsapp-sender

# Inicializa o app no Fly.io (responda as perguntas: nome do app, região gru = São Paulo)
fly launch --no-deploy

# Cria o volume persistente para a sessão do Baileys
fly volumes create baileys_data --region gru --size 1

# Define a chave secreta de autenticação (escolha qualquer senha forte)
fly secrets set WHATSAPP_API_KEY="sua-senha-secreta-aqui"
fly secrets set PORT=3001

# Faz o deploy
fly deploy
```

Aguarde a mensagem `v1 deployed successfully`.

### Etapa 5 — Obter a URL do microserviço

```bash
fly status
# Anote a URL exibida, ex: https://whatsapp-sender.fly.dev
```

### Etapa 6 — Configurar variáveis de ambiente na Vercel

1. Acesse o painel do seu projeto na Vercel → **Settings → Environment Variables**
2. Adicione duas variáveis (em todos os ambientes: Production, Preview, Development):
   - `WHATSAPP_SERVICE_URL` = `https://whatsapp-sender.fly.dev` (URL do passo anterior)
   - `WHATSAPP_API_KEY` = mesma senha que você usou no `fly secrets set`
3. Clique em **Save** e faça um novo deploy na Vercel para as variáveis entrarem em vigor

### Etapa 7 — Escanear o QR code pela primeira vez

1. Acesse o painel admin do event-remir: `/admin/settings/whatsapp`
2. Você verá um QR code na tela (status "desconectado")
3. No celular com o número dedicado: **WhatsApp → Menu → Aparelhos conectados → Conectar aparelho**
4. Aponte a câmera para o QR code na tela
5. Aguarde a tela mudar para status verde "WhatsApp conectado"

A partir desse momento o sistema envia mensagens automaticamente. A sessão fica salva no disco do Fly.io e **não precisa ser escaneada novamente** — mesmo após reinicializações do servidor.

### Etapa 8 — Configurar o link do grupo em um evento

1. No painel admin, edite ou crie um evento
2. Preencha o campo **"Link do grupo WhatsApp"** com o link do grupo (ex: `https://chat.whatsapp.com/...`)
3. Salve o evento
4. A partir de agora toda inscrição confirmada nesse evento receberá a mensagem automaticamente

### Quando precisará escanear o QR novamente?

- Se o número dedicado for desconectado manualmente pelo WhatsApp
- Se o volume de sessão do Fly.io for deletado
- Após banimento do número (raro para volumes baixos como 10–150/mês)

Em todos esses casos, basta acessar `/admin/settings/whatsapp` e escanear novamente.

---

## Mudanças necessárias no projeto principal

1. **`prisma/schema.prisma`** — adicionar `whatsappGroupLink String?` no modelo `Event`
2. **`backend/schemas/eventSchemas.ts`** — adicionar `whatsappGroupLink: z.string().url().optional()` no `EventCreateSchema`
3. **`backend/controllers/EventController.ts`** — incluir o campo no create/update
4. **`lib/whatsapp.ts`** (novo) — utilitário que chama o microserviço via `fetch()`
5. **`app/api/registrations/create-free/route.ts`** — chamar `sendWhatsAppMessage` após confirmar inscrição
6. **`app/api/payments/webhook/route.ts:335`** — implementar o TODO existente usando `sendWhatsAppMessage`
7. **`app/api/admin/whatsapp/`** (novo) — rotas de proxy para o microserviço (`/status`, `/qrcode`, `/disconnect`, `/test`)
8. **`app/admin/settings/whatsapp/page.tsx`** (novo) — tela de gerenciamento no painel admin
9. **Formulário admin de evento** (`components/admin/`) — novo campo "Link do grupo WhatsApp"
10. **`.env.local` / `.env.example`** — documentar `WHATSAPP_SERVICE_URL` e `WHATSAPP_API_KEY`

---

## Plano de ação detalhado para o agente IA

### Fase 1 — Microserviço WhatsApp (repositório separado `whatsapp-sender/`)

**Passo 1.** Criar estrutura de arquivos:

```
whatsapp-sender/
├── src/
│   ├── baileys-client.ts
│   ├── routes.ts
│   └── index.ts
├── auth_info_baileys/    ← gitignore obrigatório
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── fly.toml              ← gerado pelo fly launch, ajustar mount
└── Dockerfile
```

**Passo 2.** `package.json` — dependências:

```json
{
  "dependencies": {
    "@whiskeysockets/baileys": "^6.7.0",
    "@hapi/boom": "^10.0.0",
    "express": "^4.18.0",
    "pino": "^8.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0"
  },
  "scripts": {
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "build": "tsc"
  }
}
```

**Passo 3.** `src/baileys-client.ts` — singleton com reconexão automática e emissão de eventos de estado:

```typescript
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { EventEmitter } from "events";

export const waEvents = new EventEmitter();

let sock: WASocket | null = null;
let currentQR: string | null = null;
let connectionStatus: "disconnected" | "connecting" | "connected" = "disconnected";

export function getStatus() {
  return { status: connectionStatus, qr: currentQR };
}

export async function initWhatsAppClient(): Promise<void> {
  connectionStatus = "connecting";
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

  sock = makeWASocket({ auth: state, printQRInTerminal: true });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      currentQR = qr;
      connectionStatus = "disconnected";
      waEvents.emit("qr", qr);
    }
    if (connection === "open") {
      currentQR = null;
      connectionStatus = "connected";
      waEvents.emit("connected");
    }
    if (connection === "close") {
      connectionStatus = "disconnected";
      sock = null;
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) setTimeout(() => initWhatsAppClient(), 5000);
    }
  });
}

export async function getWhatsAppSocket(): Promise<WASocket> {
  if (!sock || connectionStatus !== "connected") {
    throw new Error("WhatsApp não está conectado");
  }
  return sock;
}

export async function disconnectWhatsApp(): Promise<void> {
  if (sock) {
    await sock.logout();
    sock = null;
    connectionStatus = "disconnected";
  }
}
```

**Passo 4.** `src/routes.ts` — endpoints da API:

```typescript
import { Router, Request, Response } from "express";
import {
  getStatus,
  getWhatsAppSocket,
  disconnectWhatsApp,
} from "./baileys-client";

const router = Router();

// Autenticação por API key
router.use((req: Request, res: Response, next) => {
  if (req.headers["x-api-key"] !== process.env.WHATSAPP_API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
});

// Status da conexão e QR code
router.get("/status", (_req: Request, res: Response) => {
  const { status, qr } = getStatus();
  res.json({ status, qr: qr ?? null });
});

// Desconectar
router.post("/disconnect", async (_req: Request, res: Response) => {
  await disconnectWhatsApp();
  res.json({ success: true });
});

// Enviar mensagem
router.post("/send-message", async (req: Request, res: Response) => {
  const { to, message } = req.body as { to?: string; message?: string };
  if (!to || !message) {
    return res.status(400).json({ error: "to e message são obrigatórios" });
  }

  const digits = to.replace(/\D/g, "");
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  const jid = `${normalized}@s.whatsapp.net`;

  let attempt = 0;
  while (attempt < 2) {
    try {
      const client = await getWhatsAppSocket();
      await client.sendMessage(jid, { text: message });
      return res.json({ success: true });
    } catch (err) {
      attempt++;
      if (attempt >= 2) {
        console.error("Falha ao enviar mensagem:", err);
        return res.status(500).json({ error: "falha ao enviar mensagem" });
      }
    }
  }
});

export default router;
```

**Passo 5.** `src/index.ts`:

```typescript
import express from "express";
import router from "./routes";
import { initWhatsAppClient } from "./baileys-client";

const app = express();
app.use(express.json());
app.use(router);
app.get("/health", (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

initWhatsAppClient().catch(console.error);
```

**Passo 6.** `Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
VOLUME ["/app/auth_info_baileys"]
ENV PORT=3001
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

**Passo 7.** `fly.toml` — após `fly launch`, editar para adicionar o mount do volume:

```toml
[build]

[[mounts]]
  source = "baileys_data"
  destination = "/app/auth_info_baileys"

[http_service]
  internal_port = 3001
  force_https = true
```

**Passo 8.** `.gitignore` do microserviço:

```
auth_info_baileys/
.env
node_modules/
dist/
```

---

### Fase 2 — Schema e validação (projeto principal)

**Passo 9.** Em `prisma/schema.prisma`, adicionar ao modelo `Event`:

```prisma
whatsappGroupLink      String?
```

**Passo 10.** Rodar `npm run db:push`.

**Passo 11.** Em `backend/schemas/eventSchemas.ts`, dentro do `EventCreateSchema`:

```typescript
whatsappGroupLink: z.string().url("URL inválida").optional().or(z.literal("")).transform(v => v || undefined),
```

**Passo 12.** Em `backend/controllers/EventController.ts`, incluir `whatsappGroupLink` nos objetos passados ao Prisma no create e update, da mesma forma que `paymentConfig` e outros campos opcionais.

---

### Fase 3 — Utilitário de envio

**Passo 13.** Criar `lib/whatsapp.ts`:

```typescript
export async function sendWhatsAppMessage(phone: string, message: string): Promise<void> {
  const url = process.env.WHATSAPP_SERVICE_URL;
  const key = process.env.WHATSAPP_API_KEY;
  if (!url || !key) return;

  try {
    const res = await fetch(`${url}/send-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({ to: phone, message }),
    });
    if (!res.ok) console.error("WhatsApp service erro:", res.status, await res.text());
  } catch (err) {
    console.error("Erro ao chamar WhatsApp service:", err);
    // Nunca propaga — não bloqueia a resposta da inscrição
  }
}
```

**Passo 14.** Adicionar ao `.env.local`:

```env
WHATSAPP_SERVICE_URL=http://localhost:3001
WHATSAPP_API_KEY=seu-token-secreto-aqui
```

E ao `.env.example` (sem valores):

```env
WHATSAPP_SERVICE_URL=
WHATSAPP_API_KEY=
```

---

### Fase 4 — Integração nos gatilhos

**Passo 15.** Em `app/api/registrations/create-free/route.ts`, após criar com status CONFIRMED:

```typescript
import { sendWhatsAppMessage } from "@/lib/whatsapp";

if (registration.phone && event.whatsappGroupLink) {
  const msg =
    `Olá ${registration.name}! ` +
    `Sua inscrição em "${event.title}" foi confirmada. ` +
    `Acesse o grupo: ${event.whatsappGroupLink}`;
  await sendWhatsAppMessage(registration.phone, msg);
}
```

Garantir que `whatsappGroupLink` está incluído no `select` ou `findUnique` do evento nessa rota.

**Passo 16.** Em `app/api/payments/webhook/route.ts`, substituir o TODO (linhas 335-339):

```typescript
if (newStatus === "CONFIRMED") {
  const eventData = await withPrismaRetry(() =>
    prisma.event.findUnique({
      where: { id: registration.eventId },
      select: { whatsappGroupLink: true, title: true },
    })
  );
  if (registration.phone && eventData?.whatsappGroupLink) {
    const msg =
      `Olá ${registration.name}! ` +
      `Seu pagamento foi confirmado e sua inscrição em "${eventData.title}" está garantida. ` +
      `Acesse o grupo: ${eventData.whatsappGroupLink}`;
    await sendWhatsAppMessage(registration.phone, msg);
  }
}
```

---

### Fase 5 — Rotas de proxy no admin (project principal)

**Passo 17.** Criar `app/api/admin/whatsapp/status/route.ts` — faz proxy para `GET /status` do microserviço, protegido pelo middleware de admin existente:

```typescript
export async function GET() {
  const url = process.env.WHATSAPP_SERVICE_URL;
  const key = process.env.WHATSAPP_API_KEY;
  if (!url || !key) return Response.json({ status: "not_configured" });

  const res = await fetch(`${url}/status`, { headers: { "x-api-key": key } });
  const data = await res.json();
  return Response.json(data);
}
```

Criar rotas equivalentes para:
- `app/api/admin/whatsapp/disconnect/route.ts` — `POST` para `POST /disconnect`
- `app/api/admin/whatsapp/test/route.ts` — `POST` que chama `sendWhatsAppMessage` com número e mensagem do body

Adicionar essas rotas ao middleware: incluir `/api/admin/whatsapp` em `adminRoutes` no `middleware.ts`.

---

### Fase 6 — Tela de configuração no painel admin

**Passo 18.** Criar `app/admin/settings/whatsapp/page.tsx` com:

- **Card de status:** verde ("Conectado — +55 11...") ou vermelho ("Desconectado"). Faz poll a cada 10s em `GET /api/admin/whatsapp/status`.
- **QR code:** quando status é `disconnected` e `qr` está presente na resposta, renderiza o QR code usando a lib `qrcode` (já instalada no projeto — ver `package.json`). Atualiza automaticamente a cada 30s com novo poll.
- **Botão "Desconectar":** visível quando conectado, chama `POST /api/admin/whatsapp/disconnect`.
- **Formulário "Enviar mensagem de teste":** campo de número + campo de texto, chama `POST /api/admin/whatsapp/test`.
- **Instrução visual:** quando QR visível, exibir passo-a-passo textual de como escanear ("Abra o WhatsApp > Menu > Aparelhos conectados > Conectar aparelho").

**Passo 19.** Adicionar link "WhatsApp" no menu de navegação do admin (`app/admin/layout.tsx` ou componente de sidebar existente), apontando para `/admin/settings/whatsapp`.

---

### Fase 7 — Frontend: campo no formulário de evento

**Passo 20.** Localizar o formulário de criação/edição de evento em `components/admin/` e adicionar campo Ant Design:

```tsx
<Form.Item
  name="whatsappGroupLink"
  label="Link do grupo WhatsApp"
  rules={[{ type: "url", message: "Informe uma URL válida" }]}
  extra="Quando preenchido, inscritos confirmados recebem este link via WhatsApp"
>
  <Input placeholder="https://chat.whatsapp.com/..." />
</Form.Item>
```

---

### Fase 8 — Deploy e variáveis de ambiente

**Passo 21.** No painel Vercel → Settings → Environment Variables, adicionar:
- `WHATSAPP_SERVICE_URL` — URL pública do app no Fly.io
- `WHATSAPP_API_KEY` — mesma chave usada no `fly secrets set`

**Passo 22.** Fazer redeploy na Vercel para as variáveis entrarem em vigor.

---

### Fase 9 — Validação end-to-end

**Passo 23.** Acessar `/admin/settings/whatsapp`, confirmar que QR code aparece, escanear com o número dedicado, confirmar status muda para "Conectado".

**Passo 24.** Usar o formulário de teste para enviar uma mensagem para um número real e confirmar recebimento.

**Passo 25.** Criar evento gratuito com `whatsappGroupLink` preenchido → fazer inscrição com número de telefone → confirmar mensagem recebida.

**Passo 26.** Simular pagamento aprovado via Mercado Pago sandbox → confirmar que o webhook dispara a mensagem.

**Passo 27.** Testar caso sem telefone preenchido: inscrição deve ser criada sem erro, sem tentativa de envio.

**Passo 28.** Testar caso sem `whatsappGroupLink` no evento: inscrição deve ser criada normalmente, sem envio.

---

## Resumo de arquivos afetados

| Arquivo | Tipo de mudança |
|---|---|
| `prisma/schema.prisma` | Adicionar `whatsappGroupLink` no modelo `Event` |
| `backend/schemas/eventSchemas.ts` | Adicionar campo opcional no `EventCreateSchema` |
| `backend/controllers/EventController.ts` | Passar campo no create/update |
| `lib/whatsapp.ts` | **Criar** — utilitário de envio |
| `app/api/registrations/create-free/route.ts` | Chamar `sendWhatsAppMessage` após confirmação |
| `app/api/payments/webhook/route.ts` | Implementar TODO na linha 335 |
| `app/api/admin/whatsapp/status/route.ts` | **Criar** — proxy de status |
| `app/api/admin/whatsapp/disconnect/route.ts` | **Criar** — proxy de disconnect |
| `app/api/admin/whatsapp/test/route.ts` | **Criar** — proxy de teste |
| `app/admin/settings/whatsapp/page.tsx` | **Criar** — tela de gerenciamento |
| `middleware.ts` | Adicionar `/api/admin/whatsapp` em `adminRoutes` |
| Formulário de evento em `components/admin/` | Adicionar campo link do grupo |
| `.env.local` / `.env.example` | Documentar novas variáveis |
| `whatsapp-sender/` (repositório separado) | **Criar** — microserviço completo |
