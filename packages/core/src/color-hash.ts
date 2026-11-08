import { COLOR_TOKENS } from './domain/constants';
import type { ColorToken } from './domain/types';

/**
 * Paleta de cores automáticas para categorias (7 cores da paleta, excluindo 'zinc').
 */
export const CATEGORY_COLORS: readonly ColorToken[] = COLOR_TOKENS.filter(
  (color): color is Exclude<ColorToken, 'zinc'> => color !== 'zinc'
);

/**
 * Calcula uma cor determinística a partir do nome da categoria (djb2 hash).
 * O mesmo nome sempre gera a mesma cor. Nunca retorna 'zinc'.
 * @param name O nome da categoria.
 * @returns A cor determinística correspondente ao nome.
 */
export function getDeterministicColor(name: string): ColorToken {
  const normalized = name.trim().toLowerCase();
  
  if (!normalized) {
    return CATEGORY_COLORS[0]!;
  }

  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0; // Converte para inteiro 32-bit com sinal
  }

  const index = Math.abs(hash) % CATEGORY_COLORS.length;
  return CATEGORY_COLORS[index]!;
}