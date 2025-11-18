import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { WorktreeSession, SessionStatus } from '../schemas';

export interface StateManager {
    createSession: (session: WorktreeSession) => void;
    getSession: (id: string) => WorktreeSession | null;
    listSessions: (status?: SessionStatus, limit?: number) => WorktreeSession[];
    updateSession: (id: string, updates: Partial<WorktreeSession>) => void;
    deleteSession: (id: string) => void;
    close: () => void;
}

export function createStateManager(stateDir: string): StateManager {
    // Ensure state directory exists
    if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
    }

    const dbPath = path.join(stateDir, 'viwo.db');
    const db = new Database(dbPath);

    // Initialize database
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        repo_path TEXT NOT NULL,
        branch_name TEXT NOT NULL,
        worktree_path TEXT NOT NULL,
        containers TEXT NOT NULL,
        ports TEXT NOT NULL,
        agent TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_activity INTEGER NOT NULL,
        error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
    `);

    function rowToSession(row: any): WorktreeSession {
        return {
            id: row.id,
            repoPath: row.repo_path,
            branchName: row.branch_name,
            worktreePath: row.worktree_path,
            containers: JSON.parse(row.containers),
            ports: JSON.parse(row.ports),
            agent: JSON.parse(row.agent),
            status: row.status as SessionStatus,
            createdAt: new Date(row.created_at),
            lastActivity: new Date(row.last_activity),
            error: row.error || undefined,
        };
    }

    return {
        createSession(session: WorktreeSession): void {
            const stmt = db.prepare(`
        INSERT INTO sessions (
          id, repo_path, branch_name, worktree_path, containers, ports, agent,
          status, created_at, last_activity, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

            stmt.run(
                session.id,
                session.repoPath,
                session.branchName,
                session.worktreePath,
                JSON.stringify(session.containers),
                JSON.stringify(session.ports),
                JSON.stringify(session.agent),
                session.status,
                session.createdAt.getTime(),
                session.lastActivity.getTime(),
                session.error || null
            );
        },

        getSession(id: string): WorktreeSession | null {
            const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
            const row = stmt.get(id) as any;

            if (!row) return null;

            return rowToSession(row);
        },

        listSessions(status?: SessionStatus, limit?: number): WorktreeSession[] {
            let query = 'SELECT * FROM sessions';
            const params: any[] = [];

            if (status) {
                query += ' WHERE status = ?';
                params.push(status);
            }

            query += ' ORDER BY created_at DESC';

            if (limit) {
                query += ' LIMIT ?';
                params.push(limit);
            }

            const stmt = db.prepare(query);
            const rows = stmt.all(...params) as any[];

            return rows.map((row) => rowToSession(row));
        },

        updateSession(id: string, updates: Partial<WorktreeSession>): void {
            const fields: string[] = [];
            const values: any[] = [];

            if (updates.status !== undefined) {
                fields.push('status = ?');
                values.push(updates.status);
            }

            if (updates.containers !== undefined) {
                fields.push('containers = ?');
                values.push(JSON.stringify(updates.containers));
            }

            if (updates.ports !== undefined) {
                fields.push('ports = ?');
                values.push(JSON.stringify(updates.ports));
            }

            if (updates.error !== undefined) {
                fields.push('error = ?');
                values.push(updates.error);
            }

            if (updates.lastActivity !== undefined) {
                fields.push('last_activity = ?');
                values.push(updates.lastActivity.getTime());
            }

            if (fields.length === 0) return;

            // Always update last_activity
            if (!updates.lastActivity) {
                fields.push('last_activity = ?');
                values.push(Date.now());
            }

            values.push(id);

            const query = `UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`;
            const stmt = db.prepare(query);
            stmt.run(...values);
        },

        deleteSession(id: string): void {
            const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
            stmt.run(id);
        },

        close(): void {
            db.close();
        },
    };
}
