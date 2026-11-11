"use client";
import { useState } from "react";
import { Play } from "lucide-react";

interface LiveFacadeProps {
  src: string;
  title: string;
  thumbnail?: string | null;
  label: string;
  /** Blocos pequenos (lista de vídeos): só o ícone, menor. */
  compact?: boolean;
}

// Só carrega o player (e os cookies do YouTube) depois do toque do usuário.
export const LiveFacade = ({
  src,
  title,
  thumbnail,
  label,
  compact = false,
}: LiveFacadeProps) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-900">
      {loaded ? (
        <iframe
          src={src}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          aria-label={`${label}: ${title}`}
          className="group absolute inset-0 flex h-full w-full cursor-pointer items-center justify-center"
        >
          {thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnail}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-80"
            />
          )}
          <span className="relative flex flex-col items-center gap-2 px-4 text-center text-white">
            <span
              className={`flex items-center justify-center rounded-full bg-[#015C91] shadow-lg transition-transform group-hover:scale-105 ${
                compact ? "h-11 w-11" : "h-16 w-16"
              }`}
            >
              <Play size={compact ? 20 : 28} fill="currentColor" />
            </span>
            {!compact && (
              <span className="text-base font-semibold drop-shadow">{label}</span>
            )}
          </span>
        </button>
      )}
    </div>
  );
};
