import { eq } from 'drizzle-orm';
import { db } from '../db';
import { sessions, NewSession, Session } from '../db-schemas';

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

export const createSession = (newSession: NewSession): Session => {
    return db.insert(sessions).values(newSession).returning().get();
};

export const updateSession = (id: number, updates: Partial<NewSession>): Session | undefined => {
    return db.update(sessions).set(updates).where(eq(sessions.id, id)).returning().get();
};

export const deleteSession = (id: number): void => {
    db.delete(sessions).where(eq(sessions.id, id)).run();
};
