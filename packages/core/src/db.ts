import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { initializeDatabase } from './db-init';
import { joinDataPath } from './utils/paths';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const dbPath = joinDataPath('sqlite.db');

// Ensure the app data directory exists
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
initializeDatabase(sqlite);
export const db = drizzle(sqlite);
