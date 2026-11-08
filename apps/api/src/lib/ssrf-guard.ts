import { isValidHttpUrl } from "@sevd/core";

/** Raised when a URL is rejected by the SSRF guard or the redirect chain is unsafe. */
export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const ALLOWED_PORTS = new Set(['', '80', '443']);
const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal'];

/**
 * Função auxiliar para verificar se um hostname IPv4 está bloqueado. Retorna `true` se o hostname estiver em uma faixa de IPs bloqueada, caso contrário, retorna `false`.
 * @param hostname - O hostname IPv4 a ser verificado.
 * @returns `true` se o hostname estiver bloqueado, caso contrário, `false`.
 */
function isBlockedIPv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number);
  const [a, b] = octets as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    (a === 100 && b >= 64 && b <= 127) ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/**
 * Verifica se um hostname IPv6 está bloqueado.
 * @param hostname - O hostname IPv6 a ser verificado.
 * @returns `true` se o hostname estiver bloqueado, caso contrário, `false`.
 */
/** `hostname` is the WHATWG-normalized form (lowercase, compressed, with brackets). */
function isBlockedIPv6(hostname: string): boolean {
  const address = hostname.slice(1, -1);
  // `::`, `::1`, `::ffff:0:0/96` (IPv4-mapped) and IPv4-compatible forms.
  if (address.startsWith('::')) return true;
  const firstGroup = parseInt(address.split(':')[0] ?? '', 16);
  if (Number.isNaN(firstGroup)) return true;
  const isUniqueLocal = firstGroup >= 0xfc00 && firstGroup <= 0xfdff; // fc00::/7
  const isLinkLocal = firstGroup >= 0xfe80 && firstGroup <= 0xfebf; // fe80::/10
  return isUniqueLocal || isLinkLocal;
}

/**
 * Verifica se uma URL é segura para uso, lançando um erro se não for.
 * @param input - A URL a ser verificada, como string ou objeto URL.
 * @returns A URL validada como segura.
 * @throws {SsrfError} Se a URL for inválida, tiver um protocolo bloqueado, porta bloqueada, hostname bloqueado ou endereço IP bloqueado.
 */
export function assertSafeUrl(input: string | URL): URL {
  let url: URL;
  try {
    url = input instanceof URL ? input : new URL(input.toString());

    if (!isValidHttpUrl(url.toString())) {
      throw new SsrfError('Invalid URL');
    }
  } catch {
    throw new SsrfError('Invalid URL');
  }

  if (!ALLOWED_PORTS.has(url.port)) {
    throw new SsrfError('Blocked port');
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new SsrfError('Blocked hostname');
  }

  if (hostname.startsWith('[')) {
    if (isBlockedIPv6(hostname)) throw new SsrfError('Blocked IP address');
  } else if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) && isBlockedIPv4(hostname)) {
    throw new SsrfError('Blocked IP address');
  }

  return url;
}

export interface SafeFetchOptions {
  maxHops: number;
  signal?: AbortSignal;
}

/** 
 * Realiza uma requisição HTTP segura com redirecionamento.
 * @param targetUrl - A URL de destino.
 * @param options - As opções para a requisição.
 * @returns Uma promessa que resolve com a resposta e a URL final.
 */
export async function safeFetchWithRedirects(
  targetUrl: string | URL,
  { maxHops, signal }: SafeFetchOptions,
): Promise<{ response: Response; finalUrl: string }> {
  let currentUrl = assertSafeUrl(targetUrl);
  let hops = 0;

  while (true) {
    const init: NonNullable<Parameters<typeof fetch>[1]> = { redirect: 'manual' };
    if (signal) init.signal = signal;
    const response = await fetch(currentUrl.href, init);

    if (!REDIRECT_STATUSES.has(response.status)) {
      return { response, finalUrl: currentUrl.href };
    }

    await response.body?.cancel();
    hops += 1;
    if (hops > maxHops) {
      throw new SsrfError('Too many redirects');
    }

    const location = response.headers.get('location');
    if (!location) {
      throw new SsrfError('Redirect without Location header');
    }

    let nextUrl: URL;
    try {
      nextUrl = new URL(location, currentUrl);
    } catch {
      throw new SsrfError('Invalid redirect Location');
    }
    currentUrl = assertSafeUrl(nextUrl);
  }
}
