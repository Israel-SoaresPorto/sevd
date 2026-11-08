export const DIACRITICS_REGEX = /[\u0300-\u036f]/g;
export const MULTIPLE_SPACES_REGEX = /\s+/g;

/**
 * Normaliza uma string para busca: converte para minúsculas,
 * remove acentos via NFD e colapsa espaços múltiplos.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) {
    return '';
  }
  return text
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .toLowerCase()
    .replace(MULTIPLE_SPACES_REGEX, ' ')
    .trim();
}

/**
 * Trunca texto para o comprimento máximo permitido, se necessário.
 * @param text O texto a ser truncado.
 * @param maxLength O comprimento máximo permitido.
 * @returns O texto truncado, se necessário.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength);
}