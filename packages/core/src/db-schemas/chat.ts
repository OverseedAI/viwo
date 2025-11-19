import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const chats = sqliteTable('chats', {
    id: integer('id').primaryKey(),
    sessionId: text('sessionId'),
    type: text('type'),
    content: text('content'),
    createdAt: text('createdAt'),
});

export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
