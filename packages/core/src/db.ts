import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { initializeDatabase } from './db-init';

const sqlite = new Database('sqlite.db');
initializeDatabase(sqlite);
export const db = drizzle(sqlite);
