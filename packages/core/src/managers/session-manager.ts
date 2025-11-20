import { eq } from 'drizzle-orm';
import { db } from '../db';
import { sessions, NewSession, Session, repositories } from '../db-schemas';
import { git } from './git-manager';

export interface ListSessionsOptions {
    status?: string;
    limit?: number;
}

export const listSessions = (options: ListSessionsOptions = {}): Session[] => {
    let query = db.select().from(sessions);

    if (options.status) {
        query = query.where(eq(sessions.status, options.status)) as typeof query;
    }

    const results = query.all();

    if (options.limit) {
        return results.slice(0, options.limit);
    }

    return results;
};

export const getSession = (id: number): Session | undefined => {
    return db.select().from(sessions).where(eq(sessions.id, id)).get();
};

export const createSession = async (newSession: NewSession): Promise<Session> => {
    const repo = db.select().from(repositories).where(eq(repositories.id, newSession.repoId)).get();

    if (!repo) {
        throw new Error('No repository found.');
    }

    await git.checkValidRepository(repo.path);

    return db.insert(sessions).values(newSession).returning().get();
};

export const updateSession = (id: number, updates: Partial<NewSession>): Session | undefined => {
    return db.update(sessions).set(updates).where(eq(sessions.id, id)).returning().get();
};

export const deleteSession = (id: number): void => {
    db.delete(sessions).where(eq(sessions.id, id)).run();
};

export const session = {
    list: listSessions,
    create: createSession,
    update: updateSession,
    delete: deleteSession,
    get: getSession,
};
