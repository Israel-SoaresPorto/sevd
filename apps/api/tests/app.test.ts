import { describe, expect, it } from 'vitest';
import defaultApp, { app } from '../src/index';

describe('app base', () => {
  it('exporta o mesmo app como named e default', () => {
    expect(defaultApp).toBe(app);
  });

  it('GET /api/health sem Sec-Fetch-Site passa', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('same-origin passa', async () => {
    const res = await app.request('/api/health', { headers: { 'Sec-Fetch-Site': 'same-origin' } });
    expect(res.status).toBe(200);
  });

  it('cross-site retorna 403', async () => {
    const res = await app.request('/api/health', { headers: { 'Sec-Fetch-Site': 'cross-site' } });
    expect(res.status).toBe(403);
  });
});
