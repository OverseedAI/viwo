import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { initializeDatabase } from './db-init';
import { joinDataPath } from './utils/paths';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Get database path based on environment.
 * Tests use a separate database to avoid overwriting production data.
 */
const getDbPath = (): string => {
    // Check if running in test environment
    if (process.env.NODE_ENV === 'test' || process.env.BUN_ENV === 'test') {
        // Use in-memory database for tests
        return ':memory:';
    }
    return joinDataPath('sqlite.db');
};

const dbPath = getDbPath();

// Only create directory if not using in-memory database
if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
}

const sqlite = new Database(dbPath);
initializeDatabase(sqlite);
export const db = drizzle(sqlite);
export { sqlite };
