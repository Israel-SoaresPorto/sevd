import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/index';
import { MAX_FAVICON_BYTES } from '../../src/routes/favicon';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const CSP = "default-src 'none'; style-src 'unsafe-inline'";
const SUCCESS_CACHE = 'public, max-age=604800, s-maxage=2592000, immutable';
const FAILURE_CACHE = 'public, max-age=3600';

function get(target?: string) {
  const query = target === undefined ? '' : `?url=${encodeURIComponent(target)}`;
  return app.request(`/api/favicon${query}`);
}

function expectFailure(res: Response) {
  expect(res.status).toBe(404);
  expect(res.headers.get('Cache-Control')).toBe(FAILURE_CACHE);
}

describe('GET /api/favicon', () => {
  it('SVG recebe CSP, nosniff e cache com headers exatos', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8' } }),
    );
    const res = await get('https://example.com/icon.svg');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
    expect(res.headers.get('Content-Security-Policy')).toBe(CSP);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Cache-Control')).toBe(SUCCESS_CACHE);
    expect(await res.text()).toBe(svg);
  });

  it('serve os bytes de uma imagem binária sem alterá-los', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(png, { headers: { 'content-type': 'image/png' } }));
    const res = await get('https://example.com/i.png');
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(png);
  });

  it('aceita octet-stream quando a URL final termina em .ico', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(new Uint8Array([0, 0, 1, 0]), { headers: { 'content-type': 'application/octet-stream' } }),
    );
    const res = await get('https://example.com/favicon.ICO');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/x-icon');
  });

  it('octet-stream sem .ico → 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(new Uint8Array([1]), { headers: { 'content-type': 'application/octet-stream' } }),
    );
    expectFailure(await get('https://example.com/file.bin'));
  });

  it('text/html → 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
    );
    expectFailure(await get('https://example.com/icon.png'));
  });

  it('> 256 KB declarado em Content-Length → 404 sem ler o corpo', async () => {
    const body = new Uint8Array(MAX_FAVICON_BYTES + 1);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(body, { headers: { 'content-type': 'image/png', 'content-length': String(body.length) } }),
    );
    expectFailure(await get('https://example.com/big.png'));
  });

  it('> 256 KB sem Content-Length → 404 e cancela o stream', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(100_000));
      },
      cancel() {
        cancelled = true;
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(stream, { headers: { 'content-type': 'image/png' } }),
    );
    expectFailure(await get('https://example.com/big.png'));
    expect(cancelled).toBe(true);
  });

  it('exatamente 256 KB é aceito', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(new Uint8Array(MAX_FAVICON_BYTES), { headers: { 'content-type': 'image/png' } }),
    );
    const res = await get('https://example.com/edge.png');
    expect(res.status).toBe(200);
    expect((await res.arrayBuffer()).byteLength).toBe(MAX_FAVICON_BYTES);
  });

  it.each([undefined, '', 'ftp://example.com/i.png', 'texto solto'])('url inválida (%s) → 404', async (target) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    expectFailure(await get(target));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['http://127.0.0.1/i.png', 'http://localhost/i.png', 'http://169.254.169.254/'])(
    'URL privada (%s) → 404 sem chamar fetch',
    async (target) => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      expectFailure(await get(target));
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('redirect para destino privado → 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'http://10.0.0.1/i.png' } }),
    );
    expectFailure(await get('https://example.com/i.png'));
  });

  it('segue até 3 redirects e aborta no 4º', async () => {
    const ok = vi.spyOn(globalThis, 'fetch');
    for (let i = 0; i < 3; i++) {
      ok.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/next.png' } }));
    }
    ok.mockResolvedValueOnce(new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } }));
    expect((await get('https://example.com/i.png')).status).toBe(200);

    vi.restoreAllMocks();
    const loop = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 302, headers: { location: '/next.png' } })),
    );
    expectFailure(await get('https://example.com/i.png'));
    expect(loop).toHaveBeenCalledTimes(4);
  });

  it('erro de rede → 404 sem vazar detalhes', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('ENOTFOUND internal-host'));
    const res = await get('https://example.com/i.png');
    expectFailure(res);
    expect(await res.text()).toBe('');
  });

  it('timeout de 2 s → 404', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    const pending = get('https://example.com/i.png');
    await vi.advanceTimersByTimeAsync(2000);
    expectFailure(await pending);
  });

  it('404 não carrega headers de sucesso', async () => {
    const res = await get();
    expect(res.headers.get('Content-Security-Policy')).toBeNull();
  });
});
