/**
 * Parser CSV mínimo (RFC 4180 simplificado), sem dependências.
 * Tolera BOM, aspas com `""` escapado, quebras de linha CRLF/LF e separador
 * `,` ou `;` (detectado pela primeira linha). Nunca interpreta fórmulas.
 */

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  let inQuotes = false;
  let commas = 0;
  let semicolons = 0;
  for (const char of firstLine) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && char === ",") commas++;
    else if (!inQuotes && char === ";") semicolons++;
  }
  return semicolons > commas ? ";" : ",";
}

export class CsvParseError extends Error {}

/** Devolve as linhas (ignorando linhas totalmente vazias). */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let wasQuoted = false;

  const endField = () => {
    row.push(field);
    field = "";
    wasQuoted = false;
  };
  const endRow = () => {
    endField();
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && field === "" && !wasQuoted) {
      inQuotes = true;
      wasQuoted = true;
    } else if (char === delimiter) {
      endField();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else {
      field += char;
    }
  }
  if (inQuotes) {
    throw new CsvParseError("Aspas sem fechamento: o arquivo parece cortado ou corrompido.");
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

/**
 * Neutraliza "CSV injection" ao gerar um CSV a partir de texto não confiável:
 * valores iniciados por =, +, -, @, tab ou CR ganham um apóstrofo à frente.
 */
export function sanitizeCsvCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
