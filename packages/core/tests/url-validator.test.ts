import { describe, expect, it } from 'vitest';
import {
  extractDomain,
  isValidHttpUrl,
} from '../src/url-validator.js';
import { InvalidUrlError } from '../src/domain/errors.js';

describe('isValidHttpUrl', () => {
  it('accepts valid URLs with http and https', () => {
    expect(isValidHttpUrl('http://example.com')).toBe(true);
    expect(isValidHttpUrl('https://example.com/caminho?query=1#hash')).toBe(true);
    expect(isValidHttpUrl('  https://example.com  ')).toBe(true);
  });

  it('rejects unsupported schemes', () => {
    expect(isValidHttpUrl('ftp://example.com/file')).toBe(false);
    expect(isValidHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isValidHttpUrl('data:text/plain;base64,SGVsbG8=')).toBe(false);
    expect(isValidHttpUrl('file:///home/user/doc.txt')).toBe(false);
  });

  it('rejects empty strings, strings containing only spaces, or malformed strings', () => {
    expect(isValidHttpUrl('')).toBe(false);
    expect(isValidHttpUrl('   ')).toBe(false);
    expect(isValidHttpUrl('not-a-url')).toBe(false);
    expect(isValidHttpUrl('http://')).toBe(false);
  });
});

describe('extractDomain', () => {
  it('extracts the domain in lowercase and removes the www. prefix.', () => {
    expect(extractDomain('https://www.Exemplo.com/x')).toBe('exemplo.com');
    expect(extractDomain('http://WWW.GITHUB.COM/user')).toBe('github.com');
  });

  it('preserves subdomains other than www.', () => {
    expect(extractDomain('https://m.youtube.com/watch?v=123')).toBe('m.youtube.com');
    expect(extractDomain('https://www2.uol.com.br/noticia')).toBe('www2.uol.com.br');
    expect(extractDomain('https://api.github.com/repos')).toBe('api.github.com');
  });

  it('throws InvalidUrlError for invalid URLs or URLs with prohibited schemes', () => {
    expect(() => extractDomain('ftp://example.com')).toThrow(InvalidUrlError);
    expect(() => extractDomain('javascript:void(0)')).toThrow(InvalidUrlError);
    expect(() => extractDomain('')).toThrow(InvalidUrlError);
    expect(() => extractDomain('invalido')).toThrow(InvalidUrlError);
  });
});