import { describe, it, expect } from "vitest";
import { normalizeText } from "../../src/utils/normalizers";

describe('normalizeText', () => {
  it('remove acentos e converte para minúsculas', () => {
    expect(normalizeText('Programação Web')).toBe('programacao web');
    expect(normalizeText('Café com Açúcar')).toBe('cafe com acucar');
    expect(normalizeText('ÁÉÍÓÚ ÀÈÌÒÙ ÂÊÎÔÛ ÃÕ Ç')).toBe('aeiou aeiou aeiou ao c');
  });
  it('colapsa espaços em branco e faz trim', () => {
    expect(normalizeText('   texto    com   muitos   espaços   ')).toBe('texto com muitos espacos');
  });
  it('trata nulos e vazios com segurança', () => {
    expect(normalizeText('')).toBe('');
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
  });
});