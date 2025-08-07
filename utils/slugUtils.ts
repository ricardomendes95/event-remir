/**
 * Converte uma string em slug (URL amigável)
 * Remove acentos, converte para minúsculas, substitui espaços por hífens
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD") // Remove acentos
    .replace(/[\u0300-\u036f]/g, "") // Remove marcas diacríticas
    .replace(/[^a-z0-9\s-]/g, "") // Remove caracteres especiais, mantém letras, números, espaços e hífens
    .replace(/\s+/g, "-") // Substitui espaços por hífens
    .replace(/-+/g, "-") // Remove hífens duplicados
    .replace(/^-|-$/g, ""); // Remove hífens do início e fim
}

/**
 * Valida se um slug está no formato correto
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug) && slug.length >= 3 && slug.length <= 100;
}
