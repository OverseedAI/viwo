import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { initializeDatabase } from '../db-init';

/**
 * Create an isolated in-memory database for testing.
 * Each test can call this to get a fresh database instance.
 *
 * @example
 * ```ts
 * import { createTestDatabase } from '../test-helpers/db';
 *
 * describe('my test', () => {
 *   let testDb;
 *
 *   beforeEach(() => {
 *     testDb = createTestDatabase();
 *   });
 *
 *   test('something', () => {
 *     // Use testDb instead of the global db
 *   });
 * });
 * ```
 */
export const createTestDatabase = () => {
    const sqlite = new Database(':memory:');
    initializeDatabase(sqlite);
    const db = drizzle(sqlite);

    return {
        sqlite,
        db,
        /**
         * Clean up the database connection.
         * Call this in afterEach if needed.
         */
        close: () => {
            sqlite.close();
        },
    };
};
