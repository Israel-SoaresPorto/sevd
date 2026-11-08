import { describe, expect, it } from 'vitest';
import { mergeBackup, sanitizePayload } from '../src/backup-sanitizer';
import type { BackupPayloadV1, Bookmark, Category } from '../src/domain/types';

describe('sanitizePayload', () => {
  it('descarta links com URL inválida e incrementa invalidUrlsDropped', () => {
    const payload: BackupPayloadV1 = {
      version: 1,
      exportedAt: 1000,
      bookmarks: [
        {
          id: '1',
          createdAt: 1000,
          updatedAt: 1000,
          deletedAt: null,
          url: 'ftp://invalido.com',
          normalizedUrl: '',
          title: 'FTP',
          domain: '',
          categoryId: null,
          tags: [],
          isFavorite: false,
        },
      ],
      categories: [],
    };

    const { payload: sanitized, report } = sanitizePayload(payload);
    expect(sanitized.bookmarks).toHaveLength(0);
    expect(report.invalidUrlsDropped).toBe(1);
  });

  it('recalcula normalizedUrl, domain e trunca limites com relatório', () => {
    const payload: BackupPayloadV1 = {
      version: 1,
      exportedAt: 1000,
      bookmarks: [
        {
          id: '1',
          createdAt: 1000,
          updatedAt: 1000,
          deletedAt: null,
          url: 'http://www.exemplo.com/pagina?utm_source=twitter',
          normalizedUrl: 'desatualizada',
          title: 'A'.repeat(250),
          note: 'B'.repeat(300),
          domain: 'antigo.com',
          categoryId: null,
          tags: ['#tag1', 'TAG2', '#tag1', 'a'.repeat(25)],
          isFavorite: false,
        },
      ],
      categories: [
        {
          id: 'cat-1',
          createdAt: 1000,
          updatedAt: 1000,
          deletedAt: null,
          name: 'C'.repeat(60),
          color: 'cor_inexistente' as any,
          icon: 'icone_inexistente' as any,
        },
      ],
    };

    const { payload: sanitized, report } = sanitizePayload(payload);
    const bm = sanitized.bookmarks[0]!;
    const cat = sanitized.categories[0]!;

    expect(bm.normalizedUrl).toBe('https://exemplo.com/pagina');
    expect(bm.domain).toBe('exemplo.com');
    expect(bm.title).toHaveLength(200);
    expect(bm.note).toHaveLength(280);
    expect(bm.tags).toEqual(['tag1', 'tag2', 'a'.repeat(20)]);

    expect(cat.name).toHaveLength(50);
    expect(cat.color).toBe('zinc');
    expect(cat.icon).toBe('Folder');

    expect(report.titlesTruncated).toBe(1);
    expect(report.notesTruncated).toBe(1);
    expect(report.tagsNormalized).toBe(1);
    expect(report.categoryNamesTruncated).toBe(1);
    expect(report.colorsNormalized).toBe(1);
    expect(report.iconsNormalized).toBe(1);
  });
});

describe('mergeBackup', () => {
  it('aplica Last-Write-Wins pelo updatedAt, inclusive para lápides', () => {
    const local: Bookmark = {
      id: 'bm-1',
      createdAt: 1000,
      updatedAt: 1000,
      deletedAt: null,
      url: 'https://exemplo.com',
      normalizedUrl: 'https://exemplo.com',
      title: 'Local Antigo',
      domain: 'exemplo.com',
      categoryId: null,
      tags: ['local'],
      isFavorite: false,
    };

    const imported: Bookmark = {
      id: 'bm-1',
      createdAt: 1000,
      updatedAt: 2000,
      deletedAt: 2000, // Lápide importada mais recente
      url: 'https://exemplo.com',
      normalizedUrl: 'https://exemplo.com',
      title: 'Importado Mais Recente',
      domain: 'exemplo.com',
      categoryId: null,
      tags: ['importado'],
      isFavorite: true,
    };

    const result = mergeBackup(
      { bookmarks: [local], categories: [] },
      { bookmarks: [imported], categories: [] }
    );

    expect(result.summary.bookmarksUpdated).toBe(1);
    expect(result.bookmarks[0]?.deletedAt).toBe(2000);
    expect(result.bookmarks[0]?.tags).toEqual(['importado']);
  });

  it('casa categoria por nome case-insensitive, mantém ID local e preenche categoryIdRemap', () => {
    const localCat: Category = {
      id: 'cat-local',
      createdAt: 1000,
      updatedAt: 1000,
      deletedAt: null,
      name: 'Trabalho',
      color: 'blue',
      icon: 'Folder',
    };

    const importedCat: Category = {
      id: 'cat-import',
      createdAt: 1500,
      updatedAt: 2000,
      deletedAt: null,
      name: 'trabalho',
      color: 'rose',
      icon: 'Briefcase',
    };

    const importedBm: Bookmark = {
      id: 'bm-import',
      createdAt: 2000,
      updatedAt: 2000,
      deletedAt: null,
      url: 'https://sevd.dev',
      normalizedUrl: 'https://sevd.dev',
      title: 'SEVD',
      domain: 'sevd.dev',
      categoryId: 'cat-import',
      tags: [],
      isFavorite: false,
    };

    const result = mergeBackup(
      { bookmarks: [], categories: [localCat] },
      { bookmarks: [importedBm], categories: [importedCat] }
    );

    expect(result.categoryIdRemap.get('cat-import')).toBe('cat-local');
    expect(result.categories[0]?.id).toBe('cat-local');
    expect(result.categories[0]?.color).toBe('rose');
    expect(result.bookmarks[0]?.categoryId).toBe('cat-local');
  });

  it('limpa categoryId para null (Inbox) se a categoria final for excluída ou inexistente', () => {
    const localCat: Category = {
      id: 'cat-1',
      createdAt: 1000,
      updatedAt: 2000,
      deletedAt: 2000, // Excluída
      name: 'Excluída',
      color: 'zinc',
      icon: 'Folder',
    };

    const importedBm: Bookmark = {
      id: 'bm-1',
      createdAt: 1000,
      updatedAt: 1000,
      deletedAt: null,
      url: 'https://exemplo.com',
      normalizedUrl: 'https://exemplo.com',
      title: 'Exemplo',
      domain: 'exemplo.com',
      categoryId: 'cat-1',
      tags: [],
      isFavorite: false,
    };

    const result = mergeBackup(
      { bookmarks: [], categories: [localCat] },
      { bookmarks: [importedBm], categories: [] }
    );

    expect(result.bookmarks[0]?.categoryId).toBeNull();
  });
});