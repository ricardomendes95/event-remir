# Requisito 4 — Foto da camisa

- **Status**: 🛠 Implementado (aguardando testes manuais e aprovação)
- **Ordem no roadmap**: 10ª
- **Requisito original**: `../requisitos.md` (item 4)
- **RFC escrito em**: 2026-07-24

## Objetivo e escopo

Upload **opcional** de imagem da camisa no cadastro do evento, exibida na etapa de escolha da camisa da inscrição (e no cartão de compra posterior do req. 5).

**Fora de escopo**: galeria com várias fotos; foto por tamanho/cor; edição de imagem no admin.

## Estado atual do código (verificado em 2026-07-24)

- Upload de imagem já resolvido: `app/api/upload/route.ts` → Cloudinary (`lib/cloudinary.ts`), com autenticação via Bearer + `canAccessPath` (perfis do req. 11) e validação de tipo (jpeg/png/webp). Usado hoje pelo banner do evento (`Event.bannerUrl`) no `EventModal`.
- Configuração de camisa em `Event.shirtConfig Json?` (`ShirtConfigSchema` em `backend/schemas/eventSchemas.ts`: `enabled`, `priceWithShirt`, `sizes`).
- Etapa de escolha da camisa: cartões "sem/com camisa" no `EventRegistrationModal`.

## Decisões de produto/UX

- Foto aparece **acima/dentro do cartão "Com camisa"** na etapa de escolha — miniatura com toque para ampliar (Preview do AntD `Image`), sem alterar a contagem de etapas.
- Sem foto → cartões exatamente como hoje (evento antigo não muda nada).
- Admin: campo de upload na seção Camisa do `EventModal`, com pré-visualização e remoção — mesmo padrão do banner.

## Arquitetura proposta

- **Sem mudança de schema Prisma**: `shirtConfig.imageUrl` (string opcional) dentro do JSON existente — `ShirtConfigSchema` ganha `imageUrl: z.string().url().optional()`. Compatibilidade retroativa garantida (campo opcional em JSON — regra do `07_FEATURE_GUIDE.md` §6).
- **Upload**: reaproveitar `POST /api/upload` como está (autorização já cobre SUPPORT, que cadastra eventos — req. 11). Nenhuma rota nova.
- **Armazenamento/compressão/cache** (pontos do requisito): delegados ao Cloudinary — a URL exibida no público usa transformação `w_800,q_auto,f_auto` (peso baixo em 3G/mobile); CDN do Cloudinary cuida do cache. Miniatura no cartão usa `w_240`.
- **Exibição pública**: `EventRegistrationModal` (etapa camisa) + comprovante/cartão do req. 5 — `loading="lazy"`, dimensões fixas (sem layout shift), `alt` descritivo.
- **Admin**: `EventModal` (seção camisa) — upload + preview + limpar; salva a URL retornada no `shirtConfig`.

## Alternativas consideradas

- Campo próprio `Event.shirtImageUrl` no schema: desnecessário — a foto pertence conceitualmente à configuração de camisa; JSON opcional evita `db push`.
- Upload direto do client para o Cloudinary (unsigned preset): descartado — a rota autenticada existente já centraliza validação e credenciais.

## Riscos e mitigação

- Peso de imagem em mobile → transformações do Cloudinary na URL (nunca servir a original).
- JSON legado sem `imageUrl` → schema Zod opcional + renderização condicional (testar evento antigo).
- Imagem quebrada (URL removida no Cloudinary) → `onError` esconde a miniatura (fallback = layout atual).

## Perguntas abertas

_Nenhuma — requisito autocontido._

## Plano de implementação

1. `ShirtConfigSchema` += `imageUrl` opcional (`backend/schemas/eventSchemas.ts`).
2. `EventModal`: upload/preview/remoção na seção camisa (reusando o componente/fluxo do banner).
3. Exibição na etapa de escolha da camisa (`EventRegistrationModal`) com transformação e lazy loading.
4. (Se req. 5 já existir) foto no cartão de compra posterior.
5. Verificação (`tsc`/lint/build) + testes manuais mobile; atualizar documentação (`04_COMPONENT_LIBRARY.md` se surgir componente de upload reutilizável).

## Critérios de aceite / testes manuais

- Admin sobe foto → aparece na etapa de camisa (mobile 375px, rede lenta simulada — imagem otimizada).
- Evento sem foto → tela idêntica à atual.
- Remover a foto no admin → some do público.
- SUPPORT consegue subir foto (cadastra eventos); CHECKIN não acessa o EventModal.
- Ampliação (preview) funciona no iOS/Instagram browser.

## Checklist

- [x] Análise técnica completa (2026-07-24)
- [x] Schema Zod de `shirtConfig` atualizado
- [x] Upload no painel admin
- [x] Exibição na etapa de escolha da camisa (mobile ainda não testado em dispositivo)
- [ ] Testes (ver `../testes.md`)
- [x] Documentação atualizada
- [ ] Aprovação do Ricardo

## Progresso / Arquivos alterados / Testes realizados / Pendências

**Arquivos**: `backend/schemas/eventSchemas.ts` (`imageUrl` opcional), `types/event.ts`, `hooks/useEventValidation.ts`, `components/admin/EventModal.tsx` (campo `ImageUpload` na seção Camisa), `utils/cloudinaryImage.ts` (transformações `w_800`/`w_240`, `q_auto,f_auto`), `components/registration/ShirtPhoto.tsx` (miniatura com ampliação, `loading="lazy"`, dimensão fixa, `alt`, `onError` esconde), exibida em `EventRegistrationModal` (individual), `BatchOrderSummary` (grupo) e `ShirtPurchaseCard` (req. 5; `shirtPurchaseService` devolve `imageUrl`).

**Testes**: `tsc` e `lint` sem erros novos; `build` passou numa cópia do projeto (o `.next` compartilhado colidiu com a tarefa paralela); Zod rejeita `imageUrl` inválida. Pendente: salvar evento com/sem foto e conferir a API pública no servidor local, e teste visual mobile.
