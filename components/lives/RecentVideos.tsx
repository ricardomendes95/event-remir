"use client";
import { useRef, useState } from "react";
import { Play, X } from "lucide-react";

export interface RecentVideo {
  id: string;
  title: string;
  thumbnail: string | null;
  publishedAt: string | null;
}

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

// Lista de vídeos no padrão de playlist: os blocos só escolhem o vídeo, que
// abre grande acima da lista (largura total, já tocando, com tela cheia).
// O player só carrega depois do toque, como no restante da página (LGPD).
export const RecentVideos = ({ videos }: { videos: RecentVideo[] }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const selected = videos.find((v) => v.id === selectedId) ?? null;

  const play = (id: string) => {
    setSelectedId(id);
    requestAnimationFrame(() =>
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">
        Últimos vídeos e transmissões
      </h2>

      {selected && (
        <div ref={playerRef} className="scroll-mt-24 space-y-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-900">
            <iframe
              key={selected.id}
              src={`https://www.youtube-nocookie.com/embed/${selected.id}?autoplay=1&playsinline=1`}
              title={selected.title}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900">{selected.title}</p>
              <p className="text-sm text-gray-500">
                {formatDate(selected.publishedAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <X size={16} />
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Celular: blocos lado a lado com rolagem lateral; telas maiores: grade. */}
      <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-2 pb-2 pt-2 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-5">
        {videos.map((video) => {
          const active = video.id === selectedId;
          return (
            <li
              key={video.id}
              className="w-[75%] shrink-0 snap-start sm:w-[45%] md:w-auto"
            >
              <button
                type="button"
                onClick={() => play(video.id)}
                aria-label={`Assistir: ${video.title}`}
                aria-pressed={active}
                className="group w-full cursor-pointer space-y-2 text-left"
              >
                <span
                  className={`relative block aspect-video w-full overflow-hidden rounded-xl bg-gray-900 ${
                    active ? "ring-4 ring-[#015C91] ring-offset-2" : ""
                  }`}
                >
                  {video.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={video.thumbnail}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center">
                    {active ? (
                      <span className="rounded-full bg-[#015C91] px-3 py-1 text-xs font-semibold text-white shadow">
                        Assistindo
                      </span>
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#015C91] text-white shadow-lg transition-transform group-hover:scale-105">
                        <Play size={20} fill="currentColor" />
                      </span>
                    )}
                  </span>
                </span>
                <span className="line-clamp-2 block text-sm font-medium text-gray-900">
                  {video.title}
                </span>
                <span className="block text-xs text-gray-500">
                  {formatDate(video.publishedAt)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
