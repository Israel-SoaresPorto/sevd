export type ColorToken =
  | 'blue'
  | 'indigo'
  | 'emerald'
  | 'rose'
  | 'amber'
  | 'cyan'
  | 'violet'
  | 'zinc';

export type CategoryIcon =
  | 'Terminal' | 'Folder' | 'Code' | 'Server' | 'Database' | 'BookOpen'
  | 'FileText' | 'Globe' | 'Cpu' | 'Layers' | 'Briefcase' | 'GraduationCap'
  | 'Wrench' | 'Palette' | 'Sparkles' | 'Video' | 'Music' | 'ShoppingBag'
  | 'Shield' | 'Zap' | 'Compass' | 'Bookmark' | 'Archive' | 'Heart';

export interface SyncFields {
  id: string;               // UUID v4 (crypto.randomUUID())
  createdAt: number;        // Epoch ms (Date.now())
  updatedAt: number;        // Epoch ms (atualizado em toda mutação)
  deletedAt: number | null; // Epoch ms quando excluído; null quando ativo
}

export interface Bookmark extends SyncFields {
  url: string;               // URL original válida http(s)
  normalizedUrl: string;     // URL canônica gerada por normalizeUrl()
  title: string;             // Máx. 200 chars; fallback = domain
  domain: string;            // Hostname em minúsculas sem 'www.'
  faviconUrl?: string;       // URL absoluta http(s) do ícone (opcional)
  note?: string;             // Máx. 280 chars (opcional)
  categoryId: string | null; // UUID da Category ativa ou null (Inbox)
  tags: string[];            // Máx. 5 tags de até 20 chars, minúsculas, sem '#'
  isFavorite: boolean;
}

export interface Category extends SyncFields {
  name: string;              // Trim, 1..50 chars, único entre ativos (case-insensitive)
  color: ColorToken;         // Padrão: getDeterministicColor(name)
  icon: CategoryIcon;        // Padrão: 'Folder'
}

export interface UserPreferences {
  theme: 'system' | 'light' | 'dark';
  viewMode: 'cards' | 'compact';
  sortBy: 'newest' | 'oldest' | 'alpha';
  fetchMetadata: boolean;             // Padrão: true
  faviconMode: 'proxy' | 'local-only'; // Padrão: 'proxy'
  lastBackupAt: number | null;
}

export interface BackupPayloadV1 {
  version: 1;
  exportedAt: number;
  bookmarks: Bookmark[];
  categories: Category[];
}

export interface MetadataDTO {
  title: string | null;
  faviconUrl: string | null;
  finalUrl: string;
}