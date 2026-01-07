import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const configurations = sqliteTable('configurations', {
    id: integer('id').primaryKey(),
    anthropicApiKey: text('anthropic_api_key'),
    preferredIde: text('preferred_ide'),
    worktreesStorageLocation: text('worktrees_storage_location'),
    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
});

export type Configuration = typeof configurations.$inferSelect;
export type NewConfiguration = typeof configurations.$inferInsert;
