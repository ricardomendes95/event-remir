/**
 * Aplica transformações do Cloudinary na URL de entrega (nunca serve a
 * original). URLs que não são do Cloudinary voltam sem alteração.
 */
export const CLOUDINARY_SHIRT_FULL = "w_800,q_auto,f_auto";
export const CLOUDINARY_SHIRT_THUMB = "w_240,q_auto,f_auto";

export function withCloudinaryTransform(
  url: string,
  transformation: string
): string {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return url;
  }
  return url.replace("/upload/", `/upload/${transformation}/`);
}
