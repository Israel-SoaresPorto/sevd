import { LIMITS } from '@sevd/core';

export const MAX_HTML_BYTES = 65_536;

export interface HtmlMetadata {
  title: string | null;
  faviconUrl: string;
}

const HTML_CONTENT_TYPES = ['text/html', 'application/xhtml+xml'];
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};

/**
 * Decodifica entidades HTML em uma string, incluindo entidades numéricas e nomeadas.
 * @param text - A string contendo entidades HTML.
 * @returns A string com as entidades decodificadas.
 */
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body.startsWith('#')) {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isNaN(code) || code < 1 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
        return match;
      }
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/**
 * Verifica se um tipo de conteúdo é HTML.
 * @param contentType - O tipo de conteúdo a ser verificado.
 * @returns `true` se o tipo de conteúdo for HTML, caso contrário, `false`.
 */
function isHtmlContentType(contentType: string | null): boolean {
  const value = (contentType ?? '').toLowerCase();
  return HTML_CONTENT_TYPES.some((type) => value.includes(type));
}

/**
 * Le a resposta HTTP até encontrar a tag de fechamento `</head>` ou atingir o limite de bytes.
 * @param response - A resposta HTTP a ser lida.
 * @returns Uma promessa que resolve com o conteúdo lido até `</head>` ou o limite de bytes.
 */
async function readHead(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder('utf-8', { fatal: false });
  let text = '';
  let bytesRead = 0;

  try {
    while (bytesRead < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = value.length > MAX_HTML_BYTES - bytesRead ? value.subarray(0, MAX_HTML_BYTES - bytesRead) : value;
      bytesRead += chunk.length;
      text += decoder.decode(chunk, { stream: true });

      if (text.toLowerCase().includes('</head>')) break;
    }
    text += decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  const headEnd = text.toLowerCase().indexOf('</head>');
  return headEnd === -1 ? text : text.slice(0, headEnd);
}

interface ParsedTag {
  attrs: Map<string, string>;
  end: number;
}

/**
 * Analisa o HTML para extrair metadados como título e favicon, respeitando a precedência de og:title → twitter:title → <title>.
 * @param response - A resposta HTTP contendo o HTML.
 * @param finalUrl - A URL final após redirecionamentos.
 * @returns Uma promessa que resolve com os metadados extraídos.
 */
function parseAttributes(html: string, start: number): ParsedTag | null {
  const attrs = new Map<string, string>();
  let i = start;
  const isSpace = (ch: string | undefined): boolean => ch !== undefined && /\s/.test(ch);

  while (i < html.length) {
    while (i < html.length && (isSpace(html[i]) || html[i] === '/')) i++;
    if (html[i] === '>') return { attrs, end: i + 1 };
    if (i >= html.length) return null;

    const nameStart = i;
    while (i < html.length && !isSpace(html[i]) && html[i] !== '=' && html[i] !== '>' && html[i] !== '/') i++;
    const name = html.slice(nameStart, i).toLowerCase();

    while (isSpace(html[i])) i++;
    let value = '';
    if (html[i] === '=') {
      i++;
      while (isSpace(html[i])) i++;
      const quote = html[i];
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, i + 1);
        if (close === -1) return null;
        value = html.slice(i + 1, close);
        i = close + 1;
      } else {
        const valueStart = i;
        while (i < html.length && !isSpace(html[i]) && html[i] !== '>') i++;
        value = html.slice(valueStart, i);
      }
    }
    if (name && !attrs.has(name)) attrs.set(name, value);
  }
  return null;
}

interface Extracted {
  ogTitle: string | null;
  twitterTitle: string | null;
  docTitle: string | null;
  icons: { rel: 'icon' | 'shortcut icon' | 'apple-touch-icon'; href: string }[];
}

/**
 * Analisa o HTML em busca de elementos específicos para extrair metadados.
 * @param html - O HTML a ser analisado.
 * @returns Um objeto contendo os metadados extraídos.
 */
function scan(html: string): Extracted {
  const found: Extracted = { ogTitle: null, twitterTitle: null, docTitle: null, icons: [] };
  const lower = html.toLowerCase();
  let i = 0;

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) break;

    if (lower.startsWith('<!--', lt)) {
      const close = lower.indexOf('-->', lt + 4);
      if (close === -1) break;
      i = close + 3;
      continue;
    }

    const nameMatch = /^<([a-z][a-z0-9-]*)/.exec(lower.slice(lt, lt + 40));
    if (!nameMatch) {
      i = lt + 1;
      continue;
    }
    const tag = nameMatch[1] ?? '';
    const afterName = lt + nameMatch[0].length;

    if (tag === 'script' || tag === 'style') {
      const close = lower.indexOf(`</${tag}`, afterName);
      if (close === -1) break;
      i = close + 1;
      continue;
    }

    if (tag === 'title') {
      const parsed = parseAttributes(html, afterName);
      if (!parsed) break;
      const close = lower.indexOf('</title', parsed.end);
      if (close === -1) break;
      if (found.docTitle === null) found.docTitle = html.slice(parsed.end, close);
      i = close + 1;
      continue;
    }

    if (tag === 'meta' || tag === 'link') {
      const parsed = parseAttributes(html, afterName);
      if (!parsed) break;
      const { attrs } = parsed;

      if (tag === 'meta') {
        const key = (attrs.get('property') ?? attrs.get('name') ?? '').toLowerCase();
        const content = attrs.get('content');
        if (content !== undefined) {
          if (key === 'og:title' && found.ogTitle === null) found.ogTitle = content;
          if (key === 'twitter:title' && found.twitterTitle === null) found.twitterTitle = content;
        }
        // `name` may differ from `property` when both are present.
        const nameKey = (attrs.get('name') ?? '').toLowerCase();
        if (content !== undefined && nameKey === 'twitter:title' && found.twitterTitle === null) {
          found.twitterTitle = content;
        }
      } else {
        const href = attrs.get('href');
        const rels = (attrs.get('rel') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
        if (href) {
          if (rels.includes('shortcut') && rels.includes('icon')) found.icons.push({ rel: 'shortcut icon', href });
          else if (rels.includes('icon')) found.icons.push({ rel: 'icon', href });
          else if (rels.includes('apple-touch-icon')) found.icons.push({ rel: 'apple-touch-icon', href });
        }
      }
      i = parsed.end;
      continue;
    }

    i = afterName;
  }
  return found;
}

/**
 * Limpa o título, decodificando entidades e removendo espaços extras.
 * @param raw - O título bruto a ser limpo.
 * @returns O título limpo ou null se estiver vazio.
 */
function cleanTitle(raw: string | null): string | null {
  if (raw === null) return null;
  const cleaned = decodeEntities(raw).replace(/\s+/g, ' ').trim().slice(0, LIMITS.TITLE_MAX_LENGTH);
  return cleaned === '' ? null : cleaned;
}

/**
 * Resolve o URL do favicon com base nos ícones extraídos e a URL final.
 * @param extracted - Os ícones extraídos.
 * @param finalUrl - A URL final após redirecionamentos.
 * @returns O URL do favicon resolvido.
 */
function resolveFavicon(extracted: Extracted, finalUrl: string): string {
  for (const rel of ['icon', 'shortcut icon', 'apple-touch-icon'] as const) {
    for (const icon of extracted.icons) {
      if (icon.rel !== rel) continue;
      try {
        return new URL(decodeEntities(icon.href).trim(), finalUrl).href;
      } catch {
        // Try the next candidate.
      }
    }
  }
  return new URL('/favicon.ico', finalUrl).href;
}

/**
 * Analisa os metadados do HTML, extraindo o título e o favicon, respeitando a precedência de og:title → twitter:title → <title>.
 * @param response - A resposta HTTP contendo o HTML.
 * @param finalUrl - A URL final após redirecionamentos.
 * @returns Uma promessa que resolve com os metadados extraídos.
 * @throws {Error} Se a resposta não for do tipo HTML.
 */
export async function parseHtmlMetadata(response: Response, finalUrl: string): Promise<HtmlMetadata> {
  if (!isHtmlContentType(response.headers.get('content-type'))) {
    await response.body?.cancel();
    return { title: null, faviconUrl: new URL('/favicon.ico', finalUrl).href };
  }

  const extracted = scan(await readHead(response));
  const title =
    cleanTitle(extracted.ogTitle) ?? cleanTitle(extracted.twitterTitle) ?? cleanTitle(extracted.docTitle);
  return { title, faviconUrl: resolveFavicon(extracted, finalUrl) };
}
