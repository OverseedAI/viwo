import type { Database } from 'bun:sqlite';
import { migrations } from './migrations';

/**
 * Initialize database by running pending migrations.
 * Tracks applied migrations in a _migrations table.
 */
export function initializeDatabase(sqlite: Database): void {
    // Create migrations tracking table
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY,
            name TEXT,
            applied_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Get already applied migrations
    const applied = sqlite.query<{ version: number }, []>("SELECT version FROM _migrations").all();
    const appliedVersions = new Set(applied.map(r => r.version));

    // Run pending migrations
    for (const migration of migrations) {
        if (!appliedVersions.has(migration.version)) {
            sqlite.exec(migration.up);
            sqlite
                .query("INSERT INTO _migrations (version, name) VALUES (?, ?)")
                .run(migration.version, migration.name);
        }
    }
}
