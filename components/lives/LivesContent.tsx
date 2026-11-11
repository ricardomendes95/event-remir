"use client";
import { useEffect, useState } from "react";
import { CalendarClock, Radio, Youtube } from "lucide-react";
import { LiveFacade } from "./LiveFacade";

interface LiveVideo {
  id: string;
  title: string;
  thumbnail: string | null;
  publishedAt: string | null;
  scheduledStart: string | null;
}

interface LivesData {
  channelId: string;
  live: LiveVideo | null;
  upcoming: LiveVideo[];
  completed: LiveVideo[];
  fallback: "embed" | null;
}

const CHANNEL_URL = "https://www.youtube.com/@ministerioremir3524";
const DEFAULT_CHANNEL_ID = "UCfLEWtCNEUdQd0D14_SQpCw";

const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const embedUrl = (id: string, autoplay = true) =>
  `https://www.youtube-nocookie.com/embed/${id}${autoplay ? "?autoplay=1" : ""}`;

const formatDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        weekday: "short",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

const ChannelLink = ({ children }: { children: React.ReactNode }) => (
  <a
    href={CHANNEL_URL}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#015C91] px-6 py-3 font-medium text-white shadow-lg transition-colors hover:bg-[#014B7A]"
  >
    <Youtube size={20} />
    {children}
  </a>
);

const Skeleton = () => (
  <div
    className="aspect-video w-full animate-pulse rounded-xl bg-gray-200"
    aria-label="Carregando transmissões"
  />
);

export const LivesContent = () => {
  const [data, setData] = useState<LivesData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/lives", { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (json?.success) setData(json.data);
        else setFailed(true);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, []);

  if (failed) {
    return (
      <div className="space-y-4 rounded-xl bg-white p-6 text-center shadow-sm">
        <p className="text-gray-700">
          Não conseguimos carregar as transmissões agora. Você pode assistir
          direto no nosso canal.
        </p>
        <ChannelLink>Abrir canal no YouTube</ChannelLink>
      </div>
    );
  }

  if (!data) return <Skeleton />;

  // Sem API: um único player da live atual (se não houver, o YouTube avisa).
  if (data.fallback === "embed") {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <Radio size={20} className="text-red-600" />
            Transmissão ao vivo
          </h2>
          <LiveFacade
            src={`https://www.youtube-nocookie.com/embed/live_stream?channel=${data.channelId || DEFAULT_CHANNEL_ID}&autoplay=1`}
            title="Transmissão ao vivo da Igreja Remir"
            label="Toque para assistir à transmissão"
          />
          <p className="text-sm text-gray-600">
            Se a transmissão não estiver acontecendo agora, o vídeo não
            aparecerá. Veja as transmissões anteriores no nosso canal.
          </p>
        </div>
        <div className="text-center">
          <ChannelLink>Ver todas as transmissões no YouTube</ChannelLink>
        </div>
      </div>
    );
  }

  const { live, upcoming, completed } = data;

  return (
    <div className="space-y-10">
      {live ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-sm font-medium text-white">
              <Radio size={14} /> Ao vivo agora
            </span>
          </h2>
          <LiveFacade
            src={embedUrl(live.id)}
            title={live.title}
            thumbnail={live.thumbnail}
            label="Toque para assistir ao vivo"
          />
          <p className="font-medium text-gray-900">{live.title}</p>
        </section>
      ) : (
        <section className="space-y-3 rounded-xl bg-white p-6 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Não há transmissão no momento
          </h2>
          <p className="text-gray-600">
            Quando a próxima transmissão começar, ela aparecerá aqui. Enquanto
            isso, assista às anteriores abaixo ou acompanhe o nosso canal.
          </p>
          <ChannelLink>Seguir o canal no YouTube</ChannelLink>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">
            Próximas transmissões
          </h2>
          <ul className="space-y-3">
            {upcoming.map((video) => (
              <li key={video.id}>
                <a
                  href={watchUrl(video.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <CalendarClock
                    size={22}
                    className="mt-0.5 shrink-0 text-[#015C91]"
                  />
                  <span>
                    <span className="block font-medium text-gray-900">
                      {video.title}
                    </span>
                    <span className="block text-sm text-gray-600">
                      {formatDateTime(video.scheduledStart) ||
                        "Data a confirmar"}
                    </span>
                    <span className="block text-sm font-medium text-[#015C91]">
                      Ativar lembrete no YouTube
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {completed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">
            Transmissões anteriores
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map((video) => (
              <li key={video.id} className="space-y-2">
                <LiveFacade
                  src={embedUrl(video.id)}
                  title={video.title}
                  thumbnail={video.thumbnail}
                  label="Assistir"
                />
                <p className="text-sm font-medium text-gray-900">
                  {video.title}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDate(video.publishedAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="text-center">
        <ChannelLink>Ver todas no canal do YouTube</ChannelLink>
      </div>
    </div>
  );
};
