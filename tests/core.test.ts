import { describe, expect, it, mock } from 'bun:test';

describe('core worktree status', () => {
    it('combines worktree and container data', async () => {
        mock.module('../src/worktree-manager', () => ({
            getWorktreeForWorktree: async () => ({
                path: '/repo/viwo-abc-main',
                branch: 'main',
                worktreeId: 'abc',
            }),
        }));
        mock.module('../src/container-manager', () => ({
            getContainersForWorktree: async () => [
                {
                    id: '1',
                    name: 'viwo-abc-dev-aaaaaa',
                    status: 'Up 2 minutes',
                    worktreeId: 'abc',
                    serviceType: 'dev',
                },
            ],
        }));
        const { getWorktreeStatus } = await import('../src/core');
        const status = await getWorktreeStatus('abc');
        expect(status).toEqual({
            worktreePath: '/repo/viwo-abc-main',
            worktreeBranch: 'main',
            containerIds: ['1'],
            status: 'active',
        });
        mock.restore();
    });
});
