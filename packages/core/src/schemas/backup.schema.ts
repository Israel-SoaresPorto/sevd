import { z } from 'zod';

/**
 * Schema base para campos de sincronização e soft delete.
 */
export const syncFieldsBackupSchema = z.object({
  id: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  deletedAt: z.number().int().nullable(),
});

/**
 * Schema estrutural de um Bookmark no arquivo de backup.
 */
export const bookmarkBackupSchema = syncFieldsBackupSchema.extend({
  url: z.string().min(1),
  normalizedUrl: z.string().min(1),
  title: z.string(),
  domain: z.string(),
  faviconUrl: z.string().optional(),
  note: z.string().optional(),
  categoryId: z.string().nullable(),
  tags: z.array(z.string()),
  isFavorite: z.boolean(),
});

/**
 * Schema estrutural de uma Categoria no arquivo de backup.
 */
export const categoryBackupSchema = syncFieldsBackupSchema.extend({
  name: z.string().min(1),
  color: z.string().min(1),
  icon: z.string().min(1),
});

/**
 * Schema principal do arquivo de backup (BackupPayloadV1).
 */
export const backupPayloadV1Schema = z.object({
  version: z.literal(1, {
    error: () => ({ message: 'Apenas a versão 1 do backup é suportada.' }),
  }),
  exportedAt: z.number().int().nonnegative(),
  bookmarks: z.array(bookmarkBackupSchema),
  categories: z.array(categoryBackupSchema),
});

export type BackupPayloadV1Schema = z.infer<typeof backupPayloadV1Schema>;