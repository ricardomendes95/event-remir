import { v2 as cloudinary } from "cloudinary";

// Configuração do Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;

// Função para upload de imagem
export async function uploadImage(file: File): Promise<string> {
  try {
    // Converter File para buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload para Cloudinary
    const result = (await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "event-remir/events", // Organizar em pastas
            resource_type: "image",
            format: "webp", // Formato otimizado
            quality: "auto:good", // Qualidade automática
            fetch_format: "auto", // Formato automático baseado no browser
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(buffer);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any;

    return result.secure_url;
  } catch (error) {
    console.error("Erro no upload da imagem:", error);
    throw new Error("Falha no upload da imagem");
  }
}

// Função para deletar imagem
export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    // Extrair public_id da URL do Cloudinary
    const parts = imageUrl.split("/");
    const filename = parts[parts.length - 1];
    const publicId = `event-remir/events/${filename.split(".")[0]}`;

    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Erro ao deletar imagem:", error);
    throw new Error("Falha ao deletar imagem");
  }
}

// Função para otimizar URL de imagem
export function optimizeImageUrl(
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: "auto" | number;
    format?: "auto" | "webp" | "jpg" | "png";
  } = {}
): string {
  if (!url.includes("cloudinary.com")) {
    return url; // Retorna URL original se não for do Cloudinary
  }

  const { width, height, quality = "auto", format = "auto" } = options;

  const transformation = [];

  if (width) transformation.push(`w_${width}`);
  if (height) transformation.push(`h_${height}`);
  if (quality) transformation.push(`q_${quality}`);
  if (format) transformation.push(`f_${format}`);

  const transformationString = transformation.join(",");

  if (transformationString) {
    return url.replace("/upload/", `/upload/${transformationString}/`);
  }

  return url;
}
