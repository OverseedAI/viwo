import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const repositories = sqliteTable('repositories', {
    id: integer('id').primaryKey(),
    name: text('name').notNull(),
    path: text('path').notNull(),
    url: text('url'),
    createdAt: text('createdAt'),
});

export type Repository = typeof repositories.$inferSelect;
export type NewRepository = typeof repositories.$inferInsert;
