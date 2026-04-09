import { describe, test, expect, beforeEach } from 'bun:test';
import { db } from '../../db';
import { sessions } from '../../db-schemas';
import {
    createSession,
    getSession,
    listSessions,
    updateSession,
    deleteSession,
} from '../session-manager';

describe('session-manager', () => {
    beforeEach(() => {
        db.delete(sessions).run();
    });

    const makeSession = (overrides = {}) => ({
        repoId: 1,
        name: 'test-session',
        path: '/tmp/worktree',
        branchName: 'viwo/test',
        ...overrides,
    });

    describe('createSession', () => {
        test('creates with initializing status', async () => {
            const session = await createSession(makeSession());
            expect(session.id).toBeDefined();
            expect(session.status).toBe('initializing');
            expect(session.name).toBe('test-session');
        });

        test('populates all provided fields', async () => {
            const session = await createSession(
                makeSession({ containerName: 'viwo-abc', agent: 'claude-code' })
            );
            expect(session.containerName).toBe('viwo-abc');
            expect(session.agent).toBe('claude-code');
        });

        test('auto-generates createdAt and lastActivity', async () => {
            const session = await createSession(makeSession());
            expect(session.createdAt).toBeDefined();
            expect(session.lastActivity).toBeDefined();
        });
    });

    describe('getSession', () => {
        test('returns session by id', async () => {
            const created = await createSession(makeSession());
            const found = getSession({ id: created.id });
            expect(found).toBeDefined();
            expect(found!.id).toBe(created.id);
            expect(found!.name).toBe('test-session');
        });

        test('returns undefined for missing id', () => {
            expect(getSession({ id: 9999 })).toBeUndefined();
        });
    });

    describe('listSessions', () => {
        test('returns empty array when no sessions', () => {
            expect(listSessions()).toEqual([]);
        });

        test('returns all sessions', async () => {
            await createSession(makeSession({ name: 'first' }));
            await createSession(makeSession({ name: 'second' }));

            const list = listSessions();
            expect(list).toHaveLength(2);
            const names = list.map((s) => s.name);
            expect(names).toContain('first');
            expect(names).toContain('second');
        });

        test('filters by status', async () => {
            const s = await createSession(makeSession({ name: 'will-run' }));
            updateSession({ id: s.id, updates: { status: 'running' } });
            await createSession(makeSession({ name: 'stays-init' }));

            const running = listSessions({ status: 'running' });
            expect(running).toHaveLength(1);
            expect(running[0]!.name).toBe('will-run');
        });

        test('respects limit', async () => {
            await createSession(makeSession({ name: 'a' }));
            await createSession(makeSession({ name: 'b' }));
            await createSession(makeSession({ name: 'c' }));

            expect(listSessions({ limit: 2 })).toHaveLength(2);
        });
    });

    describe('updateSession', () => {
        test('updates fields and returns updated session', async () => {
            const s = await createSession(makeSession());
            const updated = updateSession({
                id: s.id,
                updates: { status: 'running', containerId: 'abc123' },
            });

            expect(updated!.status).toBe('running');
            expect(updated!.containerId).toBe('abc123');
        });

        test('preserves unchanged fields', async () => {
            const s = await createSession(makeSession({ agent: 'claude-code' }));
            updateSession({ id: s.id, updates: { status: 'completed' } });

            const found = getSession({ id: s.id });
            expect(found!.agent).toBe('claude-code');
            expect(found!.status).toBe('completed');
        });

        test('returns undefined for non-existent id', () => {
            const result = updateSession({ id: 9999, updates: { status: 'error' } });
            expect(result).toBeUndefined();
        });
    });

    describe('deleteSession', () => {
        test('removes the session', async () => {
            const s = await createSession(makeSession());
            deleteSession({ id: s.id });
            expect(getSession({ id: s.id })).toBeUndefined();
        });

        test('does not affect other sessions', async () => {
            const s1 = await createSession(makeSession({ name: 'keep' }));
            const s2 = await createSession(makeSession({ name: 'delete' }));

            deleteSession({ id: s2.id });

            expect(getSession({ id: s1.id })).toBeDefined();
            expect(listSessions()).toHaveLength(1);
        });
    });
});
