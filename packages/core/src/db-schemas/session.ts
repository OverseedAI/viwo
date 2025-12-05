import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const sessions = sqliteTable('sessions', {
    id: integer('id').primaryKey(),
    repoId: integer('repoId').notNull(),
    name: text('name').notNull(),
    path: text('path').notNull(),
    branchName: text('branchName').notNull(),
    gitWorktreeName: text('gitWorktreeName'),
    containerName: text('containerName'),
    containerId: text('containerId'),
    containerImage: text('containerImage'),
    agent: text('agent'),
    status: text('status').default('initializing'),
    error: text('error'),
    containerOutput: text('containerOutput'),
    createdAt: text('createdAt').default(sql`(CURRENT_TIMESTAMP)`),
    lastActivity: text('lastActivity').default(sql`(CURRENT_TIMESTAMP)`),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
