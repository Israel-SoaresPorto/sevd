import { normalizeText } from "./utils/normalizers";

/**
 * Verifica se a query está contida no texto alvo, ignorando acentos,
 * maiúsculas/minúsculas e variações de espaçamento.
 * @param target O texto alvo onde a query será buscada.
 * @param query A query a ser buscada no texto alvo.
 * @returns true se a query estiver contida no texto alvo, false caso contrário.
 */
export function matchesQuery(
  target: string | null | undefined,
  query: string | null | undefined
): boolean {
  if (!query || !query.trim()) {
    return true;
  }
  if (!target) {
    return false;
  }
  const normalizedTarget = normalizeText(target);
  const normalizedQuery = normalizeText(query);
  return normalizedTarget.includes(normalizedQuery);
}