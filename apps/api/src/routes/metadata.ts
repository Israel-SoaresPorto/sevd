import { Hono } from 'hono';
import type { Context } from 'hono';
import { isValidHttpUrl } from '@sevd/core';
import { parseHtmlMetadata } from '../lib/html-parser';
import { safeFetchWithRedirects, SsrfError } from '../lib/ssrf-guard';

const MAX_HOPS = 5;
const TIMEOUT_MS = 3000;
const SUCCESS_CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400';
const ERROR_CACHE_CONTROL = 'no-store';

type ErrorCode = 'invalid_url' | 'blocked_url' | 'too_many_redirects' | 'timeout' | 'fetch_failed' | 'not_html';

const ERROR_STATUS = {
  invalid_url: 400,
  blocked_url: 403,
  not_html: 415,
  too_many_redirects: 502,
  fetch_failed: 502,
  timeout: 504,
} as const satisfies Record<ErrorCode, number>;

/**
 * Retorna uma resposta de erro com o código de status apropriado e o cabeçalho Cache-Control.
 * @param c - O contexto da requisição.
 * @param code - O código de erro.
 * @returns A resposta JSON com o código de erro e o status HTTP correspondente.
 */
function errorResponse(c: Context, code: ErrorCode) {
  c.header('Cache-Control', ERROR_CACHE_CONTROL);
  return c.json({ error: code }, ERROR_STATUS[code]);
}

/**
 * Classifica o erro ocorrido durante a requisição HTTP.
 * @param error - O erro ocorrido.
 * @param signal - O sinal de aborto da requisição.
 * @returns O código de erro correspondente.
 */
function classifyError(error: unknown, signal: AbortSignal): ErrorCode {
  if (signal.aborted) return 'timeout';
  if (error instanceof SsrfError) {
    return error.message === 'Too many redirects' ? 'too_many_redirects' : 'blocked_url';
  }
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return 'timeout';
  }
  return 'fetch_failed';
}

/**
 * Verifica se a resposta é HTML com base no cabeçalho Content-Type.
 * @param response - A resposta HTTP a ser verificada.
 * @returns Verdadeiro se a resposta for HTML, caso contrário, falso.
 */
function isHtml(response: Response): boolean {
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  return contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
}

export const metadataRoute = new Hono();

metadataRoute.get('/', async (c) => {
  const url = c.req.query('url');
  if (!url || !isValidHttpUrl(url)) {
    return errorResponse(c, 'invalid_url');
  }

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    const { response, finalUrl } = await safeFetchWithRedirects(url.trim(), { maxHops: MAX_HOPS, signal });

    if (!isHtml(response)) {
      await response.body?.cancel();
      return errorResponse(c, 'not_html');
    }

    const { title, faviconUrl } = await parseHtmlMetadata(response, finalUrl);
    c.header('Cache-Control', SUCCESS_CACHE_CONTROL);
    return c.json({ title, faviconUrl, finalUrl });
  } catch (error) {
    return errorResponse(c, classifyError(error, signal));
  }
});
