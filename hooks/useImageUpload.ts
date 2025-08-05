import { useState } from "react";

interface UploadState {
  uploading: boolean;
  progress: number;
  error: string | null;
  url: string | null;
}

interface UploadResponse {
  success: boolean;
  data?: {
    url: string;
    filename: string;
    size: number;
    type: string;
  };
  error?: string;
}

export function useImageUpload() {
  const [state, setState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    error: null,
    url: null,
  });

  const uploadImage = async (file: File): Promise<string | null> => {
    setState({
      uploading: true,
      progress: 0,
      error: null,
      url: null,
    });

    try {
      // Validação no frontend
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ];
      if (!allowedTypes.includes(file.type)) {
        throw new Error(
          "Tipo de arquivo não permitido. Use: JPEG, PNG ou WebP"
        );
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error("Arquivo muito grande. Tamanho máximo: 5MB");
      }

      setState((prev) => ({ ...prev, progress: 25 }));

      // Preparar FormData
      const formData = new FormData();
      formData.append("file", file);

      setState((prev) => ({ ...prev, progress: 50 }));

      // Upload
      const token = localStorage.getItem("token"); // Assumindo que o token está no localStorage

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      setState((prev) => ({ ...prev, progress: 75 }));

      const result: UploadResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Erro no upload");
      }

      setState({
        uploading: false,
        progress: 100,
        error: null,
        url: result.data!.url,
      });

      return result.data!.url;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro no upload";

      setState({
        uploading: false,
        progress: 0,
        error: errorMessage,
        url: null,
      });

      return null;
    }
  };

  const reset = () => {
    setState({
      uploading: false,
      progress: 0,
      error: null,
      url: null,
    });
  };

  return {
    ...state,
    uploadImage,
    reset,
  };
}
