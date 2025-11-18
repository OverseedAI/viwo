import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { allocatePort, allocatePorts } from './port-manager';
import { createStateManager } from './state-manager';
import { WorktreeSession } from '../schemas';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('port-manager', () => {
    let tempDir: string;
    let stateManager: ReturnType<typeof createStateManager>;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viwo-test-'));
        stateManager = createStateManager(tempDir);
    });

    afterEach(() => {
        stateManager.close();
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('allocatePort', () => {
        test('allocates a port within the specified range', async () => {
            const portRange = { start: 5000, end: 5100 };
            const port = await allocatePort(stateManager, portRange);

            expect(port).toBeGreaterThanOrEqual(5000);
            expect(port).toBeLessThanOrEqual(5100);
        });

        test('avoids ports already in use by sessions', async () => {
            const session: WorktreeSession = {
                id: 'test-session',
                repoPath: '/test/repo',
                branchName: 'test',
                worktreePath: '/test/worktree',
                containers: [],
                ports: [{ container: 3000, host: 5001, protocol: 'tcp' }],
                agent: { type: 'claude-code', initialPrompt: 'Test' },
                status: 'running',
                createdAt: new Date(),
                lastActivity: new Date(),
            };

            stateManager.createSession(session);

            const portRange = { start: 5000, end: 5100 };
            const port = await allocatePort(stateManager, portRange);

            // Should not allocate port 5001
            expect(port).not.toBe(5001);
            expect(port).toBeGreaterThanOrEqual(5000);
            expect(port).toBeLessThanOrEqual(5100);
        });
    });

    describe('allocatePorts', () => {
        test('allocates multiple ports', async () => {
            const portRange = { start: 6000, end: 6100 };
            const ports = await allocatePorts(stateManager, portRange, 3);

            expect(ports).toHaveLength(3);
            // All ports should be within range
            ports.forEach((port) => {
                expect(port).toBeGreaterThanOrEqual(6000);
                expect(port).toBeLessThanOrEqual(6100);
            });
            // All ports should be unique
            const uniquePorts = new Set(ports);
            expect(uniquePorts.size).toBe(3);
        });

        test('allocates no ports when count is zero', async () => {
            const portRange = { start: 7000, end: 7100 };
            const ports = await allocatePorts(stateManager, portRange, 0);

            expect(ports).toHaveLength(0);
        });
    });
});
