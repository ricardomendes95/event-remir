// Utilitário para formatação segura de texto
// Converte texto com marcações simples para HTML sanitizado

export const formatTextToHtml = (text: string): string => {
  if (!text) return "";

  let formatted = text
    // Escapar caracteres HTML perigosos primeiro
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")

    // Aplicar formatação
    // Negrito
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Itálico
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    // Sublinhado
    .replace(/__(.*?)__/g, "<u>$1</u>")
    // Lista não ordenada
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    // Lista numerada
    .replace(/^\d+\. (.+)$/gm, "<li-numbered>$1</li-numbered>")
    // Quebras de linha duplas (parágrafos)
    .replace(/\n\s*\n/g, "</p><p>")
    // Quebras de linha simples
    .replace(/\n/g, "<br>");

  // Envolver listas consecutivas
  formatted = formatted.replace(/(<li>.*?<\/li>)/g, "<ul>$1</ul>");
  formatted = formatted.replace(
    /(<li-numbered>.*?<\/li-numbered>)/g,
    (match) => {
      return `<ol>${match.replace(/li-numbered/g, "li")}</ol>`;
    }
  );

  // Remover listas vazias e duplicadas
  formatted = formatted.replace(/<\/ul><ul>/g, "");
  formatted = formatted.replace(/<\/ol><ol>/g, "");

  // Adicionar paragrafos se não começar/terminar com tags de bloco
  if (
    !formatted.startsWith("<") ||
    (!formatted.includes("<p>") &&
      !formatted.includes("<ul>") &&
      !formatted.includes("<ol>"))
  ) {
    formatted = `<p>${formatted}</p>`;
  }

  return formatted;
};

export const stripFormattingMarks = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^- /gm, "")
    .replace(/^\d+\. /gm, "");
};

export const getPlainText = (formattedText: string): string => {
  return stripFormattingMarks(formattedText);
};
