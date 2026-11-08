import { Hono } from 'hono';
import { isValidHttpUrl } from '@sevd/core';
import { safeFetchWithRedirects } from '../lib/ssrf-guard';

const MAX_HOPS = 3;
const TIMEOUT_MS = 2000;
export const MAX_FAVICON_BYTES = 262_144;

const SUCCESS_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'public, max-age=604800, s-maxage=2592000, immutable',
} as const;
const FAILURE_CACHE_CONTROL = 'public, max-age=3600';

function notFound(): Response {
  return new Response(null, { status: 404, headers: { 'Cache-Control': FAILURE_CACHE_CONTROL } });
}

/** 
 * Retorna o tipo MIME da imagem a ser fornecido, ou null quando a resposta não é uma imagem aceitável.
 * @param contentType O cabeçalho Content-Type da resposta
 * @param finalUrl A URL final após redirecionamentos
 * @returns O tipo MIME da imagem ou null se não for aceitável
 */
function resolveImageType(contentType: string | null, finalUrl: string): string | null {
  const type = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (type.startsWith('image/')) return type;
  if (type === 'application/octet-stream' && new URL(finalUrl).pathname.toLowerCase().endsWith('.ico')) {
    return 'image/x-icon';
  }
  return null;
}

/**
 * Lê o corpo da resposta até um limite de bytes, retornando null se o limite for excedido.
 * @param response A resposta a ser lida
 * @returns Um Uint8Array com os bytes lidos ou null se o limite for excedido
 */
async function readCapped(response: Response): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(0);

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_FAVICON_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export const faviconRoute = new Hono();

faviconRoute.get('/', async (c) => {
  const url = c.req.query('url');
  if (!url || !isValidHttpUrl(url)) return notFound();

  try {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const { response, finalUrl } = await safeFetchWithRedirects(url.trim(), { maxHops: MAX_HOPS, signal });

    const mimeType = resolveImageType(response.headers.get('content-type'), finalUrl);
    const declaredLength = Number(response.headers.get('content-length'));
    if (!mimeType || declaredLength > MAX_FAVICON_BYTES) {
      await response.body?.cancel();
      return notFound();
    }

    const bytes = await readCapped(response);
    if (!bytes) return notFound();

    return new Response(bytes, { status: 200, headers: { 'Content-Type': mimeType, ...SUCCESS_HEADERS } });
  } catch {
    return notFound();
  }
});
