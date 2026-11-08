import { TRACKING_PARAM_EXACT_KEYS, TRACKING_PARAM_PREFIX } from "./constants";
import { InvalidUrlError } from "./errors";

/**
 * Conjunto de parâmetros de rastreamento que devem ser removidos da URL.
 * Inclui tanto chaves exatas quanto prefixos de parâmetros de rastreamento.
 */
const TRACKING_SET = new Set<string>(
  TRACKING_PARAM_EXACT_KEYS.map(key => key.toLowerCase())
);

/**
 * Normaliza uma URL removendo parâmetros de rastreamento e garantindo que ela seja válida.
 * Lança um erro se a URL for inválida ou se não puder ser normalizada.
 * @param rawUrl A URL bruta a ser normalizada.
 * @returns A URL normalizada.
 */
export function normalizeUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new InvalidUrlError("Invalid URL: Input is not a string or is empty.");
  }

  let url: URL;

  // Tenta criar um objeto URL a partir da URL bruta.
  try {
    url = new URL(rawUrl.trim());
  } catch (err) {
    throw new InvalidUrlError(`Failed to create URL: ${rawUrl}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidUrlError(`Invalid URL protocol: ${url.protocol}`);
  }

  url.protocol = "https:"
  url.username = ""
  url.password = ""

  // Normalização de Host e Porta
  url.hostname = url.hostname.replace(/^www\./i, '');

  if (url.port === "80" || url.port === "443") {
    url.port = "";
  }

  // Tratamento de fragmentos (Hashs de SPAs vs ancorasde seção)
  if (!url.hash.startsWith("#/") && !url.hash.startsWith("#!")) {
    url.hash = "";
  }

  // Remoção de parâmetros de rastreamento
  const keysToRemove: string[] = [];
  url.searchParams.forEach((_, key) => {
    const lowerKey = key.toLowerCase();
    if (TRACKING_SET.has(lowerKey) || lowerKey.startsWith(TRACKING_PARAM_PREFIX)) {
      keysToRemove.push(key);
    }
  });

  for (const key of keysToRemove) {
    url.searchParams.delete(key);
  }

  url.searchParams.sort();

  const cleanPathname = url.pathname.replace(/\/+$/, '');
  const search = url.searchParams.size > 0 ? `?${url.searchParams.toString()}` : '';
  const hash = url.hash;

  return `${url.origin}${cleanPathname}${search}${hash}`;
}
