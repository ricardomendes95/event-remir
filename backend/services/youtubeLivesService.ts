// Transmissões do canal oficial no YouTube (Requisito 7).
// A chave (YOUTUBE_API_KEY) é opcional e nunca sai deste módulo.
// Sem chave, ou se a API falhar sem cache, a página usa o embed simples.

export const DEFAULT_CHANNEL_ID = "UCfLEWtCNEUdQd0D14_SQpCw";
export const CHANNEL_HANDLE_URL =
  "https://www.youtube.com/@ministerioremir3524";

const LIVE_TTL_MS = 30 * 60 * 1000;
const LISTS_TTL_MS = 6 * 60 * 60 * 1000;
const RECENT_MAX = 5;
const UPCOMING_MAX = 5;
// O canal tem transmissões agendadas antigas que nunca começaram: buscamos
// mais e mostramos só as de hoje em diante.
const UPCOMING_FETCH = 25;
const TIME_ZONE = "America/Sao_Paulo";

export interface LiveVideo {
  id: string;
  title: string;
  thumbnail: string | null;
  publishedAt: string | null;
  scheduledStart: string | null;
}

export interface LivesData {
  channelId: string;
  live: LiveVideo | null;
  upcoming: LiveVideo[];
  /** Últimos vídeos publicados no canal (lives encerradas e vídeos comuns). */
  recent: LiveVideo[];
  fallback: "embed" | null;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface SearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    publishedAt?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
}

const cache = new Map<string, CacheEntry<LiveVideo[]>>();

export function getChannelId(): string {
  return process.env.YOUTUBE_CHANNEL_ID?.trim() || DEFAULT_CHANNEL_ID;
}

function getApiBase(): string {
  return (
    process.env.YOUTUBE_API_BASE_URL?.trim() ||
    "https://www.googleapis.com/youtube/v3"
  );
}

// Limpa a chave de qualquer mensagem de erro antes de logar.
function redact(message: string, key: string): string {
  return message.split(key).join("[redacted]");
}

async function callApi<T>(
  path: string,
  params: Record<string, string>,
  key: string,
): Promise<T> {
  const url = new URL(`${getApiBase()}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set("key", key);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`YouTube API respondeu ${response.status}`);
  }
  return (await response.json()) as T;
}

function toVideo(item: SearchItem): LiveVideo | null {
  const id = item.id?.videoId;
  if (!id) return null;
  const thumbs = item.snippet?.thumbnails;
  return {
    id,
    title: item.snippet?.title ?? "Transmissão",
    thumbnail:
      thumbs?.medium?.url ?? thumbs?.high?.url ?? thumbs?.default?.url ?? null,
    publishedAt: item.snippet?.publishedAt ?? null,
    scheduledStart: null,
  };
}

async function search(
  channelId: string,
  eventType: "live" | "upcoming",
  maxResults: number,
  key: string,
): Promise<LiveVideo[]> {
  const data = await callApi<{ items?: SearchItem[] }>(
    "search",
    {
      part: "snippet",
      channelId,
      eventType,
      type: "video",
      maxResults: String(maxResults),
    },
    key,
  );
  return (data.items ?? [])
    .map(toVideo)
    .filter((v): v is LiveVideo => v !== null);
}

interface PlaylistItem {
  snippet?: {
    title?: string;
    publishedAt?: string;
    thumbnails?: Record<string, { url?: string }>;
    resourceId?: { videoId?: string };
  };
  contentDetails?: { videoPublishedAt?: string };
}

// Uploads do canal (playlist "UU…"): playlistItems.list custa 1 unidade e traz
// lives encerradas e vídeos comuns, do mais novo para o mais antigo.
async function recentUploads(
  channelId: string,
  maxResults: number,
  key: string,
): Promise<LiveVideo[]> {
  const data = await callApi<{ items?: PlaylistItem[] }>(
    "playlistItems",
    {
      part: "snippet,contentDetails",
      playlistId: `UU${channelId.slice(2)}`,
      // Folga para descartar privados e transmissões ainda não iniciadas.
      maxResults: String(maxResults + 10),
    },
    key,
  );
  return (data.items ?? [])
    .map((item): LiveVideo | null => {
      const id = item.snippet?.resourceId?.videoId;
      const title = item.snippet?.title ?? "";
      if (!id || title === "Private video" || title === "Deleted video") {
        return null;
      }
      const thumbs = item.snippet?.thumbnails;
      return {
        id,
        title,
        thumbnail:
          thumbs?.medium?.url ?? thumbs?.high?.url ?? thumbs?.default?.url ?? null,
        publishedAt:
          item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt ?? null,
        scheduledStart: null,
      };
    })
    .filter((v): v is LiveVideo => v !== null);
}

// videos.list custa 1 unidade e traz o horário agendado das próximas.
async function addScheduledStart(
  videos: LiveVideo[],
  key: string,
): Promise<LiveVideo[]> {
  if (videos.length === 0) return videos;
  const data = await callApi<{
    items?: {
      id: string;
      liveStreamingDetails?: { scheduledStartTime?: string };
    }[];
  }>(
    "videos",
    { part: "liveStreamingDetails", id: videos.map((v) => v.id).join(",") },
    key,
  );
  const starts = new Map(
    (data.items ?? []).map((i) => [
      i.id,
      i.liveStreamingDetails?.scheduledStartTime ?? null,
    ]),
  );
  return videos
    .map((v) => ({ ...v, scheduledStart: starts.get(v.id) ?? null }))
    .sort((a, b) =>
      (a.scheduledStart ?? "").localeCompare(b.scheduledStart ?? ""),
    );
}

async function cached(
  name: string,
  ttl: number,
  loader: () => Promise<LiveVideo[]>,
): Promise<LiveVideo[]> {
  const hit = cache.get(name);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  try {
    const value = await loader();
    cache.set(name, { value, expiresAt: Date.now() + ttl });
    return value;
  } catch (error) {
    // Em falha (ex.: quota), serve o cache vencido e tenta de novo mais tarde.
    if (hit) {
      cache.set(name, { value: hit.value, expiresAt: Date.now() + 5 * 60_000 });
      return hit.value;
    }
    throw error;
  }
}

export function resetLivesCache(): void {
  cache.clear();
}

export async function getLivesData(): Promise<LivesData> {
  const channelId = getChannelId();
  const key = process.env.YOUTUBE_API_KEY?.trim();
  const fallbackData: LivesData = {
    channelId,
    live: null,
    upcoming: [],
    recent: [],
    fallback: "embed",
  };
  if (!key) return fallbackData;

  try {
    const [live, upcoming, uploads] = await Promise.all([
      cached("live", LIVE_TTL_MS, () => search(channelId, "live", 1, key)),
      cached("upcoming", LISTS_TTL_MS, async () =>
        addScheduledStart(
          await search(channelId, "upcoming", UPCOMING_FETCH, key),
          key,
        ),
      ),
      cached("recent", LISTS_TTL_MS, () =>
        recentUploads(channelId, RECENT_MAX, key),
      ),
    ]);
    // Só agendadas para hoje ou depois (data de Brasília), filtrado a cada
    // resposta para não depender da validade do cache.
    const dayOf = (iso: string) =>
      new Date(iso).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
    const today = dayOf(new Date().toISOString());
    const nextUpcoming = upcoming
      .filter((v) => v.scheduledStart !== null && dayOf(v.scheduledStart) >= today)
      .slice(0, UPCOMING_MAX);
    // Fora da lista de recentes: a live em andamento e as transmissões agendadas.
    const shownElsewhere = new Set([...live, ...upcoming].map((v) => v.id));
    const recent = uploads
      .filter((v) => !shownElsewhere.has(v.id))
      .slice(0, RECENT_MAX);
    return {
      channelId,
      live: live[0] ?? null,
      upcoming: nextUpcoming,
      recent,
      fallback: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro";
    console.error("[lives] falha na YouTube API:", redact(message, key));
    return fallbackData;
  }
}
