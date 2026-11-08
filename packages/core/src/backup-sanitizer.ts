import {
  CATEGORY_ICONS,
  COLOR_TOKENS,
  LIMITS,
} from './domain/constants';
import type {
  BackupPayloadV1,
  Bookmark,
  Category,
  CategoryIcon,
  ColorToken,
} from './domain/types';
import { extractDomain, isValidHttpUrl } from './url-validator';
import { normalizeUrl } from './url-normalizer';
import { truncateText } from './utils/normalizers';
import { normalizeTag, limitTags } from './utils/tags-normalizer';

export interface SanitizationReport {
  invalidUrlsDropped: number;
  titlesTruncated: number;
  notesTruncated: number;
  tagsNormalized: number;
  categoryNamesTruncated: number;
  colorsNormalized: number;
  iconsNormalized: number;
}

export interface MergeSummary {
  bookmarksCreated: number;
  bookmarksUpdated: number;
  bookmarksIgnored: number;
  categoriesCreated: number;
  categoriesUpdated: number;
  categoriesIgnored: number;
}

export interface MergeResult {
  bookmarks: Bookmark[];
  categories: Category[];
  categoryIdRemap: Map<string, string>;
  summary: MergeSummary;
}

const COLOR_SET = new Set<string>(COLOR_TOKENS);
const ICON_SET = new Set<string>(CATEGORY_ICONS);

/**
 * Sanitiza o payload de backup, removendo URLs inválidas, truncando títulos e notas, normalizando tags, nomes de categorias, cores e ícones.
 * @param payload O payload de backup a ser sanitizado.
 * @returns Um objeto contendo o payload sanitizado e um relatório de sanitização.
 */
export function sanitizePayload(payload: BackupPayloadV1): {
  payload: BackupPayloadV1;
  report: SanitizationReport;
} {
  const report: SanitizationReport = {
    invalidUrlsDropped: 0,
    titlesTruncated: 0,
    notesTruncated: 0,
    tagsNormalized: 0,
    categoryNamesTruncated: 0,
    colorsNormalized: 0,
    iconsNormalized: 0,
  };

  const sanitizedBookmarks: Bookmark[] = [];

  // Etapa 1: Sanitização de bookmarks
  for (const rawBm of payload.bookmarks) {
    if (!isValidHttpUrl(rawBm.url)) {
      report.invalidUrlsDropped++;
      continue;
    }

    const normalizedUrl = normalizeUrl(rawBm.url);
    const domain = extractDomain(rawBm.url);

    let title = (rawBm.title ?? '').trim() || domain;
    if (title.length > LIMITS.TITLE_MAX_LENGTH) {
      title = truncateText(title, LIMITS.TITLE_MAX_LENGTH);
      report.titlesTruncated++;
    }

    let note: string | undefined = undefined;
    if (rawBm.note) {
      const trimmedNote = rawBm.note.trim();
      if (trimmedNote.length > LIMITS.NOTE_MAX_LENGTH) {
        note = truncateText(trimmedNote, LIMITS.NOTE_MAX_LENGTH);
        report.notesTruncated++;
      } else if (trimmedNote.length > 0) {
        note = trimmedNote;
      }
    }

    // Normalização de tags
    let normalizedTags: string[] = [];
    const seenTags = new Set<string>();
    let tagsChanged = false;

    const rawTags = Array.isArray(rawBm.tags) ? rawBm.tags : [];
    for (const rawTag of rawTags) {
      const cleanTag = normalizeTag(rawTag);
      if (!cleanTag) {
        tagsChanged = true;
        continue;
      }

      const truncatedTag = truncateText(cleanTag, LIMITS.TAG_MAX_LENGTH);
      if (truncatedTag !== rawTag) {
        tagsChanged = true;
      }

      if (!seenTags.has(truncatedTag)) {
        seenTags.add(truncatedTag);
        normalizedTags.push(truncatedTag);
      } else {
        tagsChanged = true;
      }
    }

    if (normalizedTags.length > LIMITS.MAX_TAGS_PER_BOOKMARK) {
      normalizedTags = limitTags(normalizedTags);
      tagsChanged = true;
    }

    if (tagsChanged) {
      report.tagsNormalized++;
    }

    sanitizedBookmarks.push({
      ...rawBm,
      url: rawBm.url.trim(),
      normalizedUrl,
      domain,
      title,
      note,
      tags: normalizedTags,
      categoryId: rawBm.categoryId ?? null,
      isFavorite: Boolean(rawBm.isFavorite),
      deletedAt: rawBm.deletedAt ?? null,
    });
  }

  const sanitizedCategories: Category[] = [];

  // Etapa 2: Sanitização de categorias
  for (const rawCat of payload.categories) {
    let name = (rawCat.name ?? '').trim();
    if (name.length > LIMITS.CATEGORY_NAME_MAX_LENGTH) {
      name = truncateText(name, LIMITS.CATEGORY_NAME_MAX_LENGTH);
      report.categoryNamesTruncated++;
    }

    // Normalização de cor e ícone
    let color = rawCat.color as ColorToken;
    if (!COLOR_SET.has(color)) {
      color = 'zinc';
      report.colorsNormalized++;
    }

    let icon = rawCat.icon as CategoryIcon;
    if (!ICON_SET.has(icon)) {
      icon = 'Folder';
      report.iconsNormalized++;
    }

    sanitizedCategories.push({
      ...rawCat,
      name,
      color,
      icon,
      deletedAt: rawCat.deletedAt ?? null,
    });
  }

  return {
    payload: {
      ...payload,
      bookmarks: sanitizedBookmarks,
      categories: sanitizedCategories,
    },
    report,
  };
}

/**
 * Mescla dois backups sanitizados, aplicando a estratégia LWW (Last Write Wins) para bookmarks e categorias.
 * @param local O backup local.
 * @param imported O backup importado.
 * @returns Um objeto contendo o backup mesclado, um mapa de remapeamento de IDs de categorias e um resumo da mesclagem.
 */
export function mergeBackup(
  local: { bookmarks: Bookmark[]; categories: Category[] },
  imported: { bookmarks: Bookmark[]; categories: Category[] }
): MergeResult {
  const summary: MergeSummary = {
    bookmarksCreated: 0,
    bookmarksUpdated: 0,
    bookmarksIgnored: 0,
    categoriesCreated: 0,
    categoriesUpdated: 0,
    categoriesIgnored: 0,
  };

  // Mapa de remapeamento de IDs de categorias do backup importado para o backup local
  const categoryIdRemap = new Map<string, string>();
  // Mapa de categorias consolidadas (ID → Categoria)
  const consolidatedCategories = new Map<string, Category>();

  // Mapa de categorias locais por ID
  const localCatById = new Map<string, Category>();
  // Mapa de categorias locais por nome normalizado
  const localCatByName = new Map<string, Category>();

  // Etapa 1: Construção de mapas de categorias locais
  for (const cat of local.categories) {
    consolidatedCategories.set(cat.id, { ...cat });
    localCatById.set(cat.id, cat);
    localCatByName.set(cat.name.trim().toLowerCase(), cat);
  }

  // Etapa 2: Mesclagem de Categorias
  for (const impCat of imported.categories) {
    const normName = impCat.name.trim().toLowerCase();
    const match = localCatById.get(impCat.id) || localCatByName.get(normName);

    // Se houver correspondência, aplica a estratégia LWW; caso contrário, adiciona a categoria importada.
    if (match) {
      const finalId = match.id;
      if (impCat.id !== finalId) {
        categoryIdRemap.set(impCat.id, finalId);
      }

      if (impCat.updatedAt > match.updatedAt) {
        consolidatedCategories.set(finalId, {
          ...impCat,
          id: finalId,
          createdAt: Math.min(match.createdAt, impCat.createdAt),
        });
        summary.categoriesUpdated++;
      } else {
        summary.categoriesIgnored++;
      }
    } else {
      consolidatedCategories.set(impCat.id, { ...impCat });
      summary.categoriesCreated++;
    }
  }

  // Etapa 3: Mesclagem de Bookmarks
  const consolidatedBookmarks = new Map<string, Bookmark>();
  const localBmById = new Map<string, Bookmark>();
  const localBmByUrl = new Map<string, Bookmark>();

  for (const bm of local.bookmarks) {
    consolidatedBookmarks.set(bm.id, { ...bm });
    localBmById.set(bm.id, bm);
    localBmByUrl.set(bm.normalizedUrl, bm);
  }

  for (const impBm of imported.bookmarks) {
    const mappedCatId = impBm.categoryId
      ? categoryIdRemap.get(impBm.categoryId) || impBm.categoryId
      : null;

    const match = localBmById.get(impBm.id) || localBmByUrl.get(impBm.normalizedUrl);

    if (match) {
      const finalId = match.id;
      if (impBm.updatedAt > match.updatedAt) {
        consolidatedBookmarks.set(finalId, {
          ...impBm,
          id: finalId,
          categoryId: mappedCatId,
          createdAt: Math.min(match.createdAt, impBm.createdAt),
        });
        summary.bookmarksUpdated++;
      } else {
        summary.bookmarksIgnored++;
      }
    } else {
      consolidatedBookmarks.set(impBm.id, {
        ...impBm,
        categoryId: mappedCatId,
      });
      summary.bookmarksCreated++;
    }
  }

  // Etapa 4: Limpeza de referências órfãs de categorias
  const activeCategoryIds = new Set<string>();
  for (const cat of consolidatedCategories.values()) {
    if (cat.deletedAt === null) {
      activeCategoryIds.add(cat.id);
    }
  }

  for (const [id, bm] of consolidatedBookmarks.entries()) {
    if (bm.categoryId !== null && !activeCategoryIds.has(bm.categoryId)) {
      consolidatedBookmarks.set(id, {
        ...bm,
        categoryId: null,
      });
    }
  }

  // Etapa 5: Retorno dos resultados
  return {
    bookmarks: Array.from(consolidatedBookmarks.values()),
    categories: Array.from(consolidatedCategories.values()),
    categoryIdRemap,
    summary,
  };
}