import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertSafeUrl, safeFetchWithRedirects, SsrfError } from '../../src/lib/ssrf-guard';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('assertSafeUrl', () => {
  it.each(['https://example.com', 'http://example.com:80', 'https://example.com:443/path?q=1', 'http://8.8.8.8'])(
    'permite %s',
    (url) => {
      expect(assertSafeUrl(url)).toBeInstanceOf(URL);
    },
  );

  it.each(['ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'not a url'])(
    'bloqueia esquema inválido: %s',
    (url) => {
      expect(() => assertSafeUrl(url)).toThrow(SsrfError);
    },
  );

  it.each(['http://example.com:8080', 'https://example.com:3000', 'http://example.com:22'])(
    'bloqueia porta não padrão: %s',
    (url) => {
      expect(() => assertSafeUrl(url)).toThrow(SsrfError);
    },
  );

  it.each([
    'http://localhost',
    'http://LOCALHOST/',
    'http://localhost./',
    'http://sub.localhost',
    'http://printer.local',
    'http://svc.internal',
    'http://metadata.google.internal',
  ])('bloqueia hostname: %s', (url) => {
    expect(() => assertSafeUrl(url)).toThrow(SsrfError);
  });

  it.each([
    'http://0.0.0.0',
    'http://0.1.2.3',
    'http://10.0.0.1',
    'http://100.64.0.1',
    'http://100.127.255.255',
    'http://127.0.0.1',
    'http://127.255.0.1',
    'http://169.254.169.254',
    'http://172.16.0.1',
    'http://172.31.255.255',
    'http://192.168.1.1',
    'http://2130706433', // decimal form of 127.0.0.1, normalized by URL
    'http://0x7f.1',
  ])('bloqueia IPv4: %s', (url) => {
    expect(() => assertSafeUrl(url)).toThrow(SsrfError);
  });

  it.each(['http://100.63.255.255', 'http://100.128.0.1', 'http://172.15.0.1', 'http://172.32.0.1', 'http://11.0.0.1'])(
    'permite IPv4 público na borda: %s',
    (url) => {
      expect(assertSafeUrl(url)).toBeInstanceOf(URL);
    },
  );

  it.each([
    'http://[::1]',
    'http://[::]',
    'http://[fc00::1]',
    'http://[fd12:3456::1]',
    'http://[fe80::1]',
    'http://[febf::1]',
    'http://[::ffff:127.0.0.1]',
    'http://[::ffff:8.8.8.8]',
  ])('bloqueia IPv6: %s', (url) => {
    expect(() => assertSafeUrl(url)).toThrow(SsrfError);
  });

  it('permite IPv6 público', () => {
    expect(assertSafeUrl('http://[2606:4700:4700::1111]')).toBeInstanceOf(URL);
  });
});

function redirect(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

describe('safeFetchWithRedirects', () => {
  it('retorna resposta sem redirect e usa redirect manual', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    const { response, finalUrl } = await safeFetchWithRedirects('https://example.com/a', { maxHops: 5 });
    expect(await response.text()).toBe('ok');
    expect(finalUrl).toBe('https://example.com/a');
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/a', { redirect: 'manual' });
  });

  it('resolve Location relativo contra a URL atual', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(redirect('/nova/pagina'))
      .mockResolvedValueOnce(redirect('../outra'))
      .mockResolvedValueOnce(new Response('ok'));
    const { finalUrl } = await safeFetchWithRedirects('https://example.com/x/y', { maxHops: 5 });
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://example.com/nova/pagina');
    expect(finalUrl).toBe('https://example.com/outra');
  });

  it('bloqueia redirect de público para privado sem fazer a requisição', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(redirect('http://127.0.0.1/admin'));
    await expect(safeFetchWithRedirects('https://example.com', { maxHops: 5 })).rejects.toThrow(SsrfError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bloqueia URL inicial insegura sem chamar fetch', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(safeFetchWithRedirects('http://localhost', { maxHops: 5 })).rejects.toThrow(SsrfError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborta no 6º salto com maxHops 5 (metadata)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(redirect('/next')));
    await expect(safeFetchWithRedirects('https://example.com', { maxHops: 5 })).rejects.toThrow('Too many redirects');
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('permite 5 saltos com maxHops 5', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    for (let i = 0; i < 5; i++) fetchMock.mockResolvedValueOnce(redirect('/next'));
    fetchMock.mockResolvedValueOnce(new Response('ok'));
    const { response } = await safeFetchWithRedirects('https://example.com', { maxHops: 5 });
    expect(await response.text()).toBe('ok');
  });

  it('aborta no 4º salto com maxHops 3 (favicon)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(redirect('/next')));
    await expect(safeFetchWithRedirects('https://example.com', { maxHops: 3 })).rejects.toThrow('Too many redirects');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('erra quando o redirect não tem Location', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 302 }));
    await expect(safeFetchWithRedirects('https://example.com', { maxHops: 5 })).rejects.toThrow(SsrfError);
  });

  it('repassa o signal ao fetch', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    const signal = AbortSignal.timeout(1000);
    await safeFetchWithRedirects('https://example.com', { maxHops: 5, signal });
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/', { redirect: 'manual', signal });
  });
});
