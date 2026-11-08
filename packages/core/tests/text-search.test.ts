import { describe, it, expect } from "vitest";
import { matchesQuery } from "../src/text-search";

describe('matchesQuery', () => {
  it('casa palavras ignorando acentuação e maiúsculas', () => {
    expect(matchesQuery('Programação em TypeScript', 'programacao')).toBe(true);
    expect(matchesQuery('Artigo sobre Café', 'cafe')).toBe(true);
    expect(matchesQuery('Notícias do Dia', 'NOTICIAS')).toBe(true);
  });
  it('retorna true quando a query for vazia ou apenas espaços', () => {
    expect(matchesQuery('Qualquer texto', '')).toBe(true);
    expect(matchesQuery('Qualquer texto', '   ')).toBe(true);
    expect(matchesQuery('Qualquer texto', null)).toBe(true);
  });
  it('retorna false quando não houver correspondência ou target for vazio', () => {
    expect(matchesQuery('Livros de Ficção', 'tecnologia')).toBe(false);
    expect(matchesQuery('', 'termo')).toBe(false);
    expect(matchesQuery(null, 'termo')).toBe(false);
  });
});