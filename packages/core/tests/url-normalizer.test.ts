import { describe, expect, it } from 'vitest';
import { InvalidUrlError } from '../src/errors.js';
import { normalizeUrl } from '../src/url-normalizer.js';

describe('normalizeUrl', () => {
  it('torna http e https equivalentes forçando https', () => {
    expect(normalizeUrl('http://example.com')).toBe('https://example.com');
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('remove credenciais embutidas', () => {
    expect(normalizeUrl('https://user:pass@example.com/caminho')).toBe(
      'https://example.com/caminho'
    );
  });

  it('remove apenas o prefixo www. e preserva subdomínios como m. e www2.', () => {
    expect(normalizeUrl('https://www.example.com')).toBe('https://example.com');
    expect(normalizeUrl('https://m.youtube.com/watch?v=123')).toBe(
      'https://m.youtube.com/watch?v=123'
    );
    expect(normalizeUrl('https://www2.uol.com.br/noticia')).toBe(
      'https://www2.uol.com.br/noticia'
    );
  });

  it('remove portas padrão 80 e 443 e mantém portas customizadas', () => {
    expect(normalizeUrl('http://example.com:80/docs')).toBe('https://example.com/docs');
    expect(normalizeUrl('https://example.com:443/docs')).toBe('https://example.com/docs');
    expect(normalizeUrl('https://example.com:8080/docs')).toBe(
      'https://example.com:8080/docs'
    );
  });

  it('preserva rotas client-side (#/ e #!) e remove âncoras de seção', () => {
    expect(normalizeUrl('https://example.com/app#/dashboard')).toBe(
      'https://example.com/app#/dashboard'
    );
    expect(normalizeUrl('https://example.com/app#!/user/42')).toBe(
      'https://example.com/app#!/user/42'
    );
    expect(normalizeUrl('https://example.com/docs#introducao')).toBe(
      'https://example.com/docs'
    );
  });

  it('remove parâmetros de rastreamento (utm_* e lista fechada) e preserva outros parâmetros', () => {
    const input =
      'https://example.com/produto?utm_source=twitter&fbclid=xyz&gclid=123&si=456&categoria=livros&ref=news';
    expect(normalizeUrl(input)).toBe('https://example.com/produto?categoria=livros');
  });

  it('ordena query params alfabeticamente', () => {
    expect(normalizeUrl('https://example.com/busca?c=3&a=1&b=2')).toBe(
      'https://example.com/busca?a=1&b=2&c=3'
    );
  });

  it('remove barra final (trailing slash) na raiz e em subpastas', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
    expect(normalizeUrl('https://example.com/docs/')).toBe('https://example.com/docs');
    expect(normalizeUrl('https://example.com/docs///')).toBe('https://example.com/docs');
    expect(normalizeUrl('https://example.com/?q=1')).toBe('https://example.com?q=1');
  });

  it('é estritamente idempotente (normalize(normalize(x)) === normalize(x))', () => {
    const urls = [
      'http://www.example.com:80/docs/?utm_source=x&b=2&a=1#secao',
      'https://m.youtube.com/watch?v=abc&si=123',
      'https://example.com/app#/dashboard?ref=mail',
    ];

    for (const url of urls) {
      const first = normalizeUrl(url);
      const second = normalizeUrl(first);
      expect(second).toBe(first);
    }
  });

  it('lança InvalidUrlError para entradas inválidas', () => {
    expect(() => normalizeUrl('ftp://example.com')).toThrow(InvalidUrlError);
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow(InvalidUrlError);
    expect(() => normalizeUrl('')).toThrow(InvalidUrlError);
  });
});