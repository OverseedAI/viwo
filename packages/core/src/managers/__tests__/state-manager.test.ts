import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { createStateManager } from '../state-manager';
import { WorktreeSession } from '../../schemas';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('state-manager', () => {
    let tempDir: string;
    let stateManager: ReturnType<typeof createStateManager>;

    beforeEach(() => {
        // Create a temporary directory for each test
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viwo-test-'));
        stateManager = createStateManager(tempDir);
    });

    afterEach(() => {
        // Close database and clean up
        stateManager.close();
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('createSession and getSession', () => {
        test('creates and retrieves a session', () => {
            const session: WorktreeSession = {
                id: 'test-session-1',
                repoPath: '/test/repo',
                branchName: 'test-branch',
                worktreePath: '/test/worktree',
                containers: [],
                ports: [],
                agent: {
                    type: 'claude-code',
                    initialPrompt: 'Test prompt',
                },
                status: 'initializing',
                createdAt: new Date(),
                lastActivity: new Date(),
            };

            stateManager.createSession(session);
            const retrieved = stateManager.getSession('test-session-1');

            expect(retrieved).not.toBeNull();
            expect(retrieved?.id).toBe('test-session-1');
            expect(retrieved?.repoPath).toBe('/test/repo');
            expect(retrieved?.status).toBe('initializing');
        });

        test('returns null for non-existent session', () => {
            const retrieved = stateManager.getSession('non-existent');
            expect(retrieved).toBeNull();
        });
    });

    describe('listSessions', () => {
        test('lists all sessions ordered by creation date', () => {
            const session1: WorktreeSession = {
                id: 'session-1',
                repoPath: '/test/repo',
                branchName: 'branch-1',
                worktreePath: '/test/worktree-1',
                containers: [],
                ports: [],
                agent: { type: 'claude-code', initialPrompt: 'Prompt 1' },
                status: 'running',
                createdAt: new Date('2025-01-01'),
                lastActivity: new Date(),
            };

            const session2: WorktreeSession = {
                id: 'session-2',
                repoPath: '/test/repo',
                branchName: 'branch-2',
                worktreePath: '/test/worktree-2',
                containers: [],
                ports: [],
                agent: { type: 'claude-code', initialPrompt: 'Prompt 2' },
                status: 'running',
                createdAt: new Date('2025-01-02'),
                lastActivity: new Date(),
            };

            stateManager.createSession(session1);
            stateManager.createSession(session2);

            const sessions = stateManager.listSessions();
            expect(sessions).toHaveLength(2);
            // Should be ordered by creation date descending
            expect(sessions[0]?.id).toBe('session-2');
            expect(sessions[1]?.id).toBe('session-1');
        });

        test('filters sessions by status', () => {
            const runningSession: WorktreeSession = {
                id: 'running-1',
                repoPath: '/test/repo',
                branchName: 'branch-1',
                worktreePath: '/test/worktree-1',
                containers: [],
                ports: [],
                agent: { type: 'claude-code', initialPrompt: 'Prompt' },
                status: 'running',
                createdAt: new Date(),
                lastActivity: new Date(),
            };

            const stoppedSession: WorktreeSession = {
                id: 'stopped-1',
                repoPath: '/test/repo',
                branchName: 'branch-2',
                worktreePath: '/test/worktree-2',
                containers: [],
                ports: [],
                agent: { type: 'claude-code', initialPrompt: 'Prompt' },
                status: 'stopped',
                createdAt: new Date(),
                lastActivity: new Date(),
            };

            stateManager.createSession(runningSession);
            stateManager.createSession(stoppedSession);

            const runningSessions = stateManager.listSessions('running');
            expect(runningSessions).toHaveLength(1);
            expect(runningSessions[0]?.id).toBe('running-1');
        });
    });

    describe('updateSession', () => {
        test('updates session status', () => {
            const session: WorktreeSession = {
                id: 'update-test',
                repoPath: '/test/repo',
                branchName: 'branch',
                worktreePath: '/test/worktree',
                containers: [],
                ports: [],
                agent: { type: 'claude-code', initialPrompt: 'Prompt' },
                status: 'initializing',
                createdAt: new Date(),
                lastActivity: new Date(),
            };

            stateManager.createSession(session);
            stateManager.updateSession('update-test', { status: 'running' });

            const updated = stateManager.getSession('update-test');
            expect(updated?.status).toBe('running');
        });
    });

    describe('deleteSession', () => {
        test('deletes a session', () => {
            const session: WorktreeSession = {
                id: 'delete-test',
                repoPath: '/test/repo',
                branchName: 'branch',
                worktreePath: '/test/worktree',
                containers: [],
                ports: [],
                agent: { type: 'claude-code', initialPrompt: 'Prompt' },
                status: 'running',
                createdAt: new Date(),
                lastActivity: new Date(),
            };

            stateManager.createSession(session);
            stateManager.deleteSession('delete-test');

            const deleted = stateManager.getSession('delete-test');
            expect(deleted).toBeNull();
        });
    });
});
