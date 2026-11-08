import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/index';

afterEach(() => {
  vi.restoreAllMocks();
});

const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8' };
const SUCCESS_CACHE = 'public, max-age=3600, s-maxage=86400';

function get(target?: string) {
  const query = target === undefined ? '' : `?url=${encodeURIComponent(target)}`;
  return app.request(`/api/metadata${query}`);
}

function htmlPage(head: string): Response {
  return new Response(`<html><head>${head}</head><body></body></html>`, { headers: HTML_HEADERS });
}

describe('GET /api/metadata', () => {
  it('caminho feliz: title, faviconUrl e finalUrl após redirect, com cache', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: 'https://www.example.com/home' } }))
      .mockResolvedValueOnce(htmlPage('<title>Exemplo</title><link rel="icon" href="/f.png">'));
    const res = await get('https://example.com');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(SUCCESS_CACHE);
    expect(await res.json()).toEqual({
      title: 'Exemplo',
      faviconUrl: 'https://www.example.com/f.png',
      finalUrl: 'https://www.example.com/home',
    });
  });

  it('página HTML sem título responde 200 com title null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(htmlPage(''));
    const res = await get('https://example.com');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      title: null,
      faviconUrl: 'https://example.com/favicon.ico',
      finalUrl: 'https://example.com/',
    });
  });

  it.each([undefined, '', 'ftp://example.com', 'texto solto'])('url inválida (%s) → 400', async (target) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const res = await get(target);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_url' });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['http://127.0.0.1', 'http://localhost', 'http://169.254.169.254', 'https://example.com:8443'])(
    'URL bloqueada (%s) → 403 sem chamar fetch nem vazar detalhes',
    async (target) => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      const res = await get(target);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'blocked_url' });
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('redirect para destino privado → 403', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'http://10.0.0.1/' } }),
    );
    const res = await get('https://example.com');
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'blocked_url' });
  });

  it('redirects demais → 502 too_many_redirects', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 302, headers: { location: '/next' } })),
    );
    const res = await get('https://example.com');
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'too_many_redirects' });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('timeout (AbortError) → 504', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const res = await get('https://example.com');
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ error: 'timeout' });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('timeout real do sinal de 3 s → 504', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
          }),
      );
      const pending = get('https://example.com');
      await vi.advanceTimersByTimeAsync(3000);
      const res = await pending;
      expect(res.status).toBe(504);
      expect(await res.json()).toEqual({ error: 'timeout' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('erro de rede → 502 fetch_failed sem vazar a mensagem', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('getaddrinfo ENOTFOUND internal-host'));
    const res = await get('https://example.com');
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: 'fetch_failed' });
    expect(text).not.toContain('ENOTFOUND');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('Content-Type não-HTML → 415 not_html', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', { headers: { 'content-type': 'application/json' } }),
    );
    const res = await get('https://example.com/api');
    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({ error: 'not_html' });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('respostas de erro não usam o cache de sucesso', async () => {
    const res = await get();
    expect(res.headers.get('Cache-Control')).not.toBe(SUCCESS_CACHE);
  });

  it('o filtro de origem continua valendo', async () => {
    const res = await app.request('/api/metadata?url=https%3A%2F%2Fexample.com', {
      headers: { 'Sec-Fetch-Site': 'cross-site' },
    });
    expect(res.status).toBe(403);
  });
});
