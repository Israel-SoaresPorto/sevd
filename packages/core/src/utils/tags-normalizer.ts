import { LIMITS } from "../domain/constants";

/**
 * Remove o prefixo de hashtag de uma tag, se presente.
 * @param tag A tag da qual remover o prefixo de hashtag.
 * @returns A tag sem o prefixo de hashtag.
 */
export function removeHashtagPrefix(tag: string): string {
  return tag.replace(/#/i, '');
}

/**
 * Limita o número de tags a um máximo definido.
 * @param tags O array de tags a ser limitado.
 * @returns Um novo array contendo apenas as primeiras N tags, onde N é o limite definido.
 */
export function limitTags(tags: string[]): string[] {
  return tags.slice(0, LIMITS.MAX_TAGS_PER_BOOKMARK);
}

/**
 * Normaliza uma tag removendo o prefixo de hashtag, convertendo para minúsculas e removendo espaços em branco.
 * @param tag A tag a ser normalizada.
 * @returns A tag normalizada.
 */
export function normalizeTag(tag: string): string {
  return removeHashtagPrefix(tag).trim().toLowerCase();
}