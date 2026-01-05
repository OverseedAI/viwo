import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { repositories, NewRepository, Repository, sessions } from '../db-schemas';
import { isValidRepository } from './git-manager';

export interface ListRepositoryOptions {
    archived?: boolean;
    orderByRecentlyUsed?: boolean;
}

export const listRepositories = (options: ListRepositoryOptions): Repository[] => {
    const { orderByRecentlyUsed = false } = options;

    if (orderByRecentlyUsed) {
        // Order by most recently used based on session activity
        const query = db
            .select({
                id: repositories.id,
                name: repositories.name,
                path: repositories.path,
                url: repositories.url,
                createdAt: repositories.createdAt,
                lastUsedAt: sql<string>`MAX(${sessions.lastActivity})`.as('lastUsedAt'),
            })
            .from(repositories)
            .leftJoin(sessions, eq(repositories.id, sessions.repoId))
            .groupBy(repositories.id)
            .orderBy(desc(sql`lastUsedAt`))
            .all();

        // Return as Repository[] (strip the lastUsedAt field)
        return query.map(({ lastUsedAt, ...repo }) => repo);
    }

    // TODO: Add archived filtering when schema supports it
    return db.select().from(repositories).all();
};

export const getRepositoryById = ({ id }: { id: number }) => {
    return db.select().from(repositories).where(eq(repositories.id, id)).get();
};

const formatPath = (path: string): string => {
    const trimmed = path.trim();

    if (trimmed.endsWith('/')) {
        const trailingSlashRemoved = trimmed.slice(0, trimmed.length - 1);

        return trailingSlashRemoved;
    }

    return trimmed;
};

export const createRepository = async (newRepo: NewRepository): Promise<Repository> => {
    const formattedPath = formatPath(newRepo.path);
    const isValid = await isValidRepository({ repoPath: newRepo.path });

    if (!isValid) {
        throw new Error(`Invalid git repository: ${newRepo.path}`);
    }

    // Check if repo is already added
    const foundRepo = db
        .select()
        .from(repositories)
        .where(eq(repositories.path, formattedPath))
        .get();

    if (foundRepo) {
        throw new Error('Repository already exists');
    }

    return db
        .insert(repositories)
        .values({ ...newRepo, path: formattedPath })
        .returning()
        .get();
};

export interface DeleteRepositoryOptions {
    id: number;
}

export const deleteRepository = (options: DeleteRepositoryOptions): void => {
    db.delete(repositories).where(eq(repositories.id, options.id)).run();
};

export const repo = {
    list: listRepositories,
    create: createRepository,
    delete: deleteRepository,
};
