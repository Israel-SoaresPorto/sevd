import { describe, expect, it } from 'vitest';
import { MAX_HTML_BYTES, parseHtmlMetadata } from '../../src/lib/html-parser';

const BASE = 'https://example.com/dir/page';

function htmlResponse(body: string | ReadableStream<Uint8Array>, contentType = 'text/html; charset=utf-8'): Response {
  return new Response(body, { headers: { 'content-type': contentType } });
}

/** Stream that serves `chunks` and records how many bytes were pulled and whether it was cancelled. */
function trackedStream(chunks: Uint8Array[]) {
  const state = { pulledBytes: 0, cancelled: false };
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index++];
      if (!chunk) {
        controller.close();
        return;
      }
      state.pulledBytes += chunk.length;
      controller.enqueue(chunk);
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return { stream, state };
}

const enc = (text: string) => new TextEncoder().encode(text);

describe('parseHtmlMetadata', () => {
  it('extrai title e favicon (caminho feliz)', async () => {
    const html = '<html><head><title>Olá</title><link rel="icon" href="/i.png"></head><body></body></html>';
    expect(await parseHtmlMetadata(htmlResponse(html), BASE)).toEqual({
      title: 'Olá',
      faviconUrl: 'https://example.com/i.png',
    });
  });

  it('respeita a precedência og:title → twitter:title → <title>', async () => {
    const all =
      '<head><title>T</title><meta name="twitter:title" content="TW"><meta property="og:title" content="OG"></head>';
    expect((await parseHtmlMetadata(htmlResponse(all), BASE)).title).toBe('OG');
    const noOg = '<head><title>T</title><meta name="twitter:title" content="TW"></head>';
    expect((await parseHtmlMetadata(htmlResponse(noOg), BASE)).title).toBe('TW');
    const onlyTitle = '<head><title>T</title></head>';
    expect((await parseHtmlMetadata(htmlResponse(onlyTitle), BASE)).title).toBe('T');
  });

  it('aceita atributos em ordem diferente e aspas variadas', async () => {
    const html = `<head><meta content='A &amp; B' property='og:title'><link href=/x.ico type=image/x-icon REL="Shortcut  Icon"></head>`;
    expect(await parseHtmlMetadata(htmlResponse(html), BASE)).toEqual({
      title: 'A & B',
      faviconUrl: 'https://example.com/x.ico',
    });
  });

  it('decodifica entidades', async () => {
    const html = '<head><title>Tom &amp; Jerry&#39;s &#x41; &lt;3</title></head>';
    expect((await parseHtmlMetadata(htmlResponse(html), BASE)).title).toBe("Tom & Jerry's A <3");
  });

  it('colapsa espaços e limita o título a 200 caracteres', async () => {
    const html = `<head><title>\n  ${'a'.repeat(300)}  b\n</title></head>`;
    const { title } = await parseHtmlMetadata(htmlResponse(html), BASE);
    expect(title).toHaveLength(200);
  });

  it('título vazio vira null', async () => {
    expect((await parseHtmlMetadata(htmlResponse('<head><title>  </title></head>'), BASE)).title).toBeNull();
  });

  it('precedência de favicon: icon → shortcut icon → apple-touch-icon → /favicon.ico', async () => {
    const all =
      '<head><link rel="apple-touch-icon" href="/a.png"><link rel="shortcut icon" href="/s.ico"><link rel="icon" href="/i.png"></head>';
    expect((await parseHtmlMetadata(htmlResponse(all), BASE)).faviconUrl).toBe('https://example.com/i.png');
    const noIcon = '<head><link rel="apple-touch-icon" href="/a.png"><link rel="shortcut icon" href="/s.ico"></head>';
    expect((await parseHtmlMetadata(htmlResponse(noIcon), BASE)).faviconUrl).toBe('https://example.com/s.ico');
    const onlyApple = '<head><link rel="apple-touch-icon" href="/a.png"></head>';
    expect((await parseHtmlMetadata(htmlResponse(onlyApple), BASE)).faviconUrl).toBe('https://example.com/a.png');
    expect((await parseHtmlMetadata(htmlResponse('<head></head>'), BASE)).faviconUrl).toBe(
      'https://example.com/favicon.ico',
    );
  });

  it('favicon relativo vira absoluto contra finalUrl', async () => {
    const rel = '<head><link rel="icon" href="icons/f.png"></head>';
    expect((await parseHtmlMetadata(htmlResponse(rel), BASE)).faviconUrl).toBe('https://example.com/dir/icons/f.png');
    const protoRel = '<head><link rel="icon" href="//cdn.example.org/f.png"></head>';
    expect((await parseHtmlMetadata(htmlResponse(protoRel), BASE)).faviconUrl).toBe('https://cdn.example.org/f.png');
  });

  it('ignora tags dentro de comentários, script e style', async () => {
    const html =
      '<head><!-- <title>no</title> --><script>var s = "<title>x</title>";</script><style>/* <title>y</title> */</style><title>Yes</title></head>';
    expect((await parseHtmlMetadata(htmlResponse(html), BASE)).title).toBe('Yes');
  });

  it('para ao achar </head> (case-insensitive) e cancela o stream', async () => {
    const { stream, state } = trackedStream([
      enc('<HEAD><TITLE>X</TITLE></HEAD>'),
      enc('<body><title>Late</title></body>'),
      enc('more'),
    ]);
    const result = await parseHtmlMetadata(htmlResponse(stream), BASE);
    expect(result.title).toBe('X');
    expect(state.cancelled).toBe(true);
    expect(state.pulledBytes).toBeLessThan(enc('<HEAD><TITLE>X</TITLE></HEAD>').length + 10);
  });

  it('corta exatamente em 64 KB sem </head>', async () => {
    const title = '<title>OK</title>';
    const pad = (n: number) => ' '.repeat(n);
    // The title ends exactly at byte 65,536: still parsed.
    const exact = pad(MAX_HTML_BYTES - title.length) + title;
    expect(enc(exact).length).toBe(MAX_HTML_BYTES);
    expect((await parseHtmlMetadata(htmlResponse(exact), BASE)).title).toBe('OK');
    // Pushed past the limit, the closing tag is cut off: not parsed.
    const over = pad(MAX_HTML_BYTES - title.length + 8) + title;
    expect((await parseHtmlMetadata(htmlResponse(over), BASE)).title).toBeNull();
  });

  it('cancela o stream após atingir 64 KB', async () => {
    const chunks = Array.from({ length: 10 }, () => new Uint8Array(10_000).fill(0x20));
    const { stream, state } = trackedStream(chunks);
    await parseHtmlMetadata(htmlResponse(stream), BASE);
    expect(state.cancelled).toBe(true);
  });

  it('não considera conteúdo além de 64 KB', async () => {
    const filler = ' '.repeat(MAX_HTML_BYTES);
    const html = `<head>${filler}<title>Too late</title></head>`;
    expect((await parseHtmlMetadata(htmlResponse(html), BASE)).title).toBeNull();
  });

  it('Content-Type não-HTML cancela o body e retorna title null', async () => {
    const { stream, state } = trackedStream([enc('{"a":1}')]);
    const result = await parseHtmlMetadata(htmlResponse(stream, 'application/json'), BASE);
    expect(state.cancelled).toBe(true);
    expect(result).toEqual({ title: null, faviconUrl: 'https://example.com/favicon.ico' });
  });

  it('aceita application/xhtml+xml', async () => {
    const res = htmlResponse('<head><title>X</title></head>', 'application/xhtml+xml');
    expect((await parseHtmlMetadata(res, BASE)).title).toBe('X');
  });

  it('tolera HTML truncado/malformado sem lançar', async () => {
    const html = '<head><meta property="og:title" content="Aberto<title>Z';
    await expect(parseHtmlMetadata(htmlResponse(html), BASE)).resolves.toEqual({
      title: null,
      faviconUrl: 'https://example.com/favicon.ico',
    });
  });
});
