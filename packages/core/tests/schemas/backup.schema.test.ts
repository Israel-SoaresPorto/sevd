import { describe, expect, it } from 'vitest';
import { backupPayloadV1Schema } from '../../src/schemas/backup.schema';

describe('backupPayloadV1Schema', () => {
  const validPayload = {
    version: 1,
    exportedAt: 1700000000000,
    bookmarks: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        deletedAt: null,
        url: 'https://exemplo.com',
        normalizedUrl: 'https://exemplo.com',
        title: 'Exemplo',
        domain: 'exemplo.com',
        categoryId: null,
        tags: ['tech', 'web'],
        isFavorite: true,
      },
    ],
    categories: [
      {
        id: '987fcdeb-51a2-43f7-9abc-def012345678',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        deletedAt: null,
        name: 'Trabalho',
        color: 'blue',
        icon: 'Folder',
      },
    ],
  };

  it('valida com sucesso um payload V1 estruturalmente correto', () => {
    const result = backupPayloadV1Schema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('falha se version for diferente de 1', () => {
    const invalid = { ...validPayload, version: 2 };
    const result = backupPayloadV1Schema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('versão 1');
    }
  });

  it('falha se bookmarks ou categories não forem arrays', () => {
    expect(
      backupPayloadV1Schema.safeParse({ ...validPayload, bookmarks: null }).success
    ).toBe(false);

    expect(
      backupPayloadV1Schema.safeParse({ ...validPayload, categories: 'invalido' }).success
    ).toBe(false);
  });

  it('falha se campos primitivos de bookmark tiverem tipos errados', () => {
    const invalidBookmark = {
      ...validPayload,
      bookmarks: [
        {
          ...validPayload.bookmarks[0],
          isFavorite: 'sim', // deveria ser boolean
        },
      ],
    };

    const result = backupPayloadV1Schema.safeParse(invalidBookmark);
    expect(result.success).toBe(false);
  });
});