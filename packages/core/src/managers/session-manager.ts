import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { NewSession, Session, sessions } from '../db-schemas';

export interface ListSessionsOptions {
    status?: string;
    limit?: number;
}

export const listSessions = (options: ListSessionsOptions = {}): Session[] => {
    let query = db.select().from(sessions);

    if (options.status) {
        query = query.where(eq(sessions.status, options.status)) as typeof query;
    }

    query = query.orderBy(desc(sessions.createdAt)) as typeof query;

    const results = query.all();

    if (options.limit) {
        return results.slice(0, options.limit);
    }

    return results;
};

export interface GetSessionOptions {
    id: number;
}

export const getSession = (options: GetSessionOptions): Session | undefined => {
    return db.select().from(sessions).where(eq(sessions.id, options.id)).get();
};

export const createSession = async (newSession: NewSession): Promise<Session> => {
    return db
        .insert(sessions)
        .values({
            ...newSession,
            status: 'initializing',
        })
        .returning()
        .get();
};

export interface UpdateSessionOptions {
    id: number;
    updates: Partial<NewSession>;
}

export const updateSession = (options: UpdateSessionOptions): Session | undefined => {
    return db
        .update(sessions)
        .set(options.updates)
        .where(eq(sessions.id, options.id))
        .returning()
        .get();
};

export interface DeleteSessionOptions {
    id: number;
}

export const deleteSession = (options: DeleteSessionOptions): void => {
    db.delete(sessions).where(eq(sessions.id, options.id)).run();
};

export const session = {
    list: listSessions,
    create: createSession,
    update: updateSession,
    delete: deleteSession,
    get: getSession,
};
