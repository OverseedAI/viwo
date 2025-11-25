import { describe, it, expect, beforeEach } from 'bun:test';
import { sessionToWorktreeSession } from '../types';
import type { Session } from '../../db-schemas';
import { db } from '../../db';
import { repositories } from '../../db-schemas';

describe('sessionToWorktreeSession', () => {
    beforeEach(() => {
        // Clean up test data
        db.delete(repositories).run();
    });

    it('should parse SQLite CURRENT_TIMESTAMP format correctly', () => {
        // Insert a test repository
        const repo = db
            .insert(repositories)
            .values({
                name: 'test-repo',
                path: '/tmp/test-repo',
                createdAt: new Date().toISOString(),
            })
            .returning()
            .get();

        const dbSession: Session = {
            id: 1,
            repoId: repo.id,
            name: 'test-session',
            path: '/tmp/test-worktree',
            branchName: 'test-branch',
            gitWorktreeName: 'test-worktree',
            containerName: null,
            containerId: null,
            containerImage: null,
            agent: 'claude-code',
            status: 'running',
            error: null,
            // SQLite CURRENT_TIMESTAMP format
            createdAt: '2025-11-24 10:30:45',
            lastActivity: '2025-11-24 12:15:30',
        };

        const result = sessionToWorktreeSession(dbSession);

        expect(result).not.toBeNull();
        expect(result!.createdAt).toBeInstanceOf(Date);
        expect(result!.lastActivity).toBeInstanceOf(Date);

        // Verify the dates are parsed correctly
        expect(result!.createdAt.toISOString()).toBe('2025-11-24T10:30:45.000Z');
        expect(result!.lastActivity.toISOString()).toBe('2025-11-24T12:15:30.000Z');
    });

    it('should handle null timestamps gracefully', () => {
        const repo = db
            .insert(repositories)
            .values({
                name: 'test-repo',
                path: '/tmp/test-repo',
                createdAt: new Date().toISOString(),
            })
            .returning()
            .get();

        const dbSession: Session = {
            id: 1,
            repoId: repo.id,
            name: 'test-session',
            path: '/tmp/test-worktree',
            branchName: 'test-branch',
            gitWorktreeName: 'test-worktree',
            containerName: null,
            containerId: null,
            containerImage: null,
            agent: 'claude-code',
            status: 'running',
            error: null,
            createdAt: null,
            lastActivity: null,
        };

        const result = sessionToWorktreeSession(dbSession);

        expect(result).not.toBeNull();
        expect(result!.createdAt).toBeInstanceOf(Date);
        expect(result!.lastActivity).toBeInstanceOf(Date);
        // Should use current time as fallback
        expect(result!.createdAt.getTime()).toBeGreaterThan(Date.now() - 1000);
    });

    it('should handle invalid timestamp strings', () => {
        const repo = db
            .insert(repositories)
            .values({
                name: 'test-repo',
                path: '/tmp/test-repo',
                createdAt: new Date().toISOString(),
            })
            .returning()
            .get();

        const dbSession: Session = {
            id: 1,
            repoId: repo.id,
            name: 'test-session',
            path: '/tmp/test-worktree',
            branchName: 'test-branch',
            gitWorktreeName: 'test-worktree',
            containerName: null,
            containerId: null,
            containerImage: null,
            agent: 'claude-code',
            status: 'running',
            error: null,
            createdAt: 'invalid-date',
            lastActivity: 'not-a-date',
        };

        const result = sessionToWorktreeSession(dbSession);

        expect(result).not.toBeNull();
        expect(result!.createdAt).toBeInstanceOf(Date);
        expect(result!.lastActivity).toBeInstanceOf(Date);
        // Should fall back to current time
        expect(result!.createdAt.getTime()).toBeGreaterThan(Date.now() - 1000);
    });
});
