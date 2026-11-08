import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { metadataRoute } from './routes/metadata';

/** Rejects requests initiated by other sites (browser-sent `Sec-Fetch-Site: cross-site`). */
export const originFilter = createMiddleware(async (c, next) => {
  if (c.req.header('Sec-Fetch-Site') === 'cross-site') {
    return c.json({ error: 'forbidden' }, 403);
  }
  await next();
});

export const app = new Hono().basePath('/api');

app.use('*', originFilter);

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/metadata', metadataRoute);

export default app;
