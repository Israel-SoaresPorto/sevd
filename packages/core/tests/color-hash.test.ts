import { describe, expect, it } from 'vitest';
import { getDeterministicColor, CATEGORY_COLORS } from '../src/color-hash.js';

describe('getDeterministicColor', () => {
  it('gera sempre a mesma cor para o mesmo nome (determinístico e estável)', () => {
    const color1 = getDeterministicColor('Trabalho');
    const color2 = getDeterministicColor('Trabalho');
    expect(color1).toBe(color2);

    expect(getDeterministicColor('Estudos')).toBe(getDeterministicColor('estudos'));
    expect(getDeterministicColor('  Dev  ')).toBe(getDeterministicColor('dev'));
  });

  it('nunca retorna zinc, mesmo em centenas de variações', () => {
    const testCases = [
      'Trabalho', 'Estudos', 'Finanças', 'Livros', 'Artigos', 'Projetos',
      'Receitas', 'Academia', 'Música', 'Viagens', 'Jogos', 'Inbox', '', ' '
    ];

    for (const name of testCases) {
      expect(getDeterministicColor(name)).not.toBe('zinc');
      expect(CATEGORY_COLORS).toContain(getDeterministicColor(name));
    }

    // Teste de estresse com 500 strings aleatórias
    for (let i = 0; i < 500; i++) {
      const randomStr = Math.random().toString(36).substring(2);
      expect(getDeterministicColor(randomStr)).not.toBe('zinc');
    }
  });
});