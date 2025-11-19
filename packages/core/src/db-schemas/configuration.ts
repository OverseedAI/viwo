import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
    id: integer('id').primaryKey(),
    repoId: integer('repoId').notNull(),
    name: text('name').notNull(),
    path: text('path').notNull(),
    gitWorktreeName: text('gitWorktreeName'),
    containerName: text('containerName'),
    containerId: text('containerId'),
    containerImage: text('containerImage'),
    agentId: text('agentId'),
    status: text('status'),
    error: text('error'),
    createdAt: text('createdAt'),
    lastActivity: text('lastActivity'),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
