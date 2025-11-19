import { sqliteTable, integer } from 'drizzle-orm/sqlite-core';

export const configurations = sqliteTable('configurations', {
    id: integer('id').primaryKey(),
    claudeApiToken: integer('claudeApiToken'),
});
