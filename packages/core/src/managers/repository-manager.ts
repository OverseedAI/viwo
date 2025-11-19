import { eq } from 'drizzle-orm';
import { db } from '../db';
import { repositories, NewRepository, Repository } from '../db-schemas';

export interface ListRepositoryOptions {
    archived?: boolean;
}

export const listRepositories = (_options: ListRepositoryOptions): Repository[] => {
    // TODO: Add archived filtering when schema supports it
    return db.select().from(repositories).all();
};

export const createRepository = (newRepo: NewRepository): Repository => {
    return db.insert(repositories).values(newRepo).returning().get();
};

export const deleteRepository = (id: number): void => {
    db.delete(repositories).where(eq(repositories.id, id)).run();
};

export const repo = {
    list: listRepositories,
    create: createRepository,
    delete: deleteRepository,
};
