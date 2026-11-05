import type { CategoryIcon, ColorToken, UserPreferences } from './types';

// Limites do sistema
export const LIMITS = {
  TITLE_MAX_LENGTH: 200,
  NOTE_MAX_LENGTH: 280,
  CATEGORY_NAME_MAX_LENGTH: 50,
  TAG_MAX_LENGTH: 20,
  MAX_TAGS_PER_BOOKMARK: 5,
} as const;

// Lista canônica de 8 cores
export const COLOR_TOKENS: readonly ColorToken[] = [
  'blue',
  'indigo',
  'emerald',
  'rose',
  'amber',
  'cyan',
  'violet',
  'zinc',
] as const;

// Lista canônica de 24 ícones
export const CATEGORY_ICONS: readonly CategoryIcon[] = [
  'Terminal', 'Folder', 'Code', 'Server', 'Database', 'BookOpen',
  'FileText', 'Globe', 'Cpu', 'Layers', 'Briefcase', 'GraduationCap',
  'Wrench', 'Palette', 'Sparkles', 'Video', 'Music', 'ShoppingBag',
  'Shield', 'Zap', 'Compass', 'Bookmark', 'Archive', 'Heart',
] as const;

// Preferências padrão do usuário
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  viewMode: 'cards',
  sortBy: 'newest',
  fetchMetadata: true,
  faviconMode: 'proxy',
  lastBackupAt: null,
};

// Parâmetros de rastreamento a remover na normalização de URLs (T-012)
export const TRACKING_PARAM_PREFIX = 'utm_' as const;

export const TRACKING_PARAM_EXACT_KEYS: readonly string[] = [
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'twclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
  'si',
] as const;