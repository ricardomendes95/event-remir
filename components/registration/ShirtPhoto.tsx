"use client";

import { useState } from "react";
import { Image } from "antd";
import {
  CLOUDINARY_SHIRT_FULL,
  CLOUDINARY_SHIRT_THUMB,
  withCloudinaryTransform,
} from "@/utils/cloudinaryImage";

interface ShirtPhotoProps {
  src: string;
  /** Dimensão fixa da miniatura (evita layout shift). */
  size?: "sm" | "md";
}

const SIZES = { sm: 80, md: 120 } as const;

/**
 * Miniatura da camisa com toque para ampliar. Usa transformações do
 * Cloudinary (miniatura leve; ampliação a 800px) e some se a imagem falhar.
 */
export function ShirtPhoto({ src, size = "md" }: ShirtPhotoProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  const dimension = SIZES[size];
  return (
    <div data-testid="shirt-photo">
      <Image
        src={withCloudinaryTransform(src, CLOUDINARY_SHIRT_THUMB)}
        alt="Foto da camisa do evento"
        width={dimension}
        height={dimension}
        loading="lazy"
        style={{ objectFit: "cover", borderRadius: 8 }}
        preview={{ src: withCloudinaryTransform(src, CLOUDINARY_SHIRT_FULL) }}
        onError={() => setFailed(true)}
      />
      <p className="text-xs text-gray-500 mt-1">Toque na foto para ampliar</p>
    </div>
  );
}
