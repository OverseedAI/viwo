import { describe, test, expect, mock } from 'bun:test';

let capturedOptions: Record<string, unknown> | null = null;

const mockInspect = mock(() =>
    Promise.resolve({
        Id: 'test-id',
        Name: '/test-container',
        State: { Status: 'created' },
        Created: new Date().toISOString(),
    })
);

mock.module('dockerode', () => ({
    default: class MockDocker {
        createContainer = (opts: Record<string, unknown>) => {
            capturedOptions = opts;
            return Promise.resolve({ inspect: mockInspect });
        };
        getImage = () => ({
            inspect: () => Promise.resolve({}),
        });
        ping = () => Promise.resolve();
    },
}));

const { createContainer } = await import('../docker-manager');

describe('createContainer security hardening', () => {
    test('drops all Linux capabilities', async () => {
        capturedOptions = null;

        await createContainer({
            name: 'test-security',
            image: 'test-image:latest',
            worktreePath: '/tmp/test-worktree',
        });

        const hostConfig = (capturedOptions as unknown as Record<string, unknown>)
            .HostConfig as Record<string, unknown>;
        expect(hostConfig.CapDrop).toEqual(['ALL']);
    });

    test('sets no-new-privileges security option', async () => {
        capturedOptions = null;

        await createContainer({
            name: 'test-security',
            image: 'test-image:latest',
            worktreePath: '/tmp/test-worktree',
        });

        const hostConfig = (capturedOptions as unknown as Record<string, unknown>)
            .HostConfig as Record<string, unknown>;
        expect(hostConfig.SecurityOpt).toEqual(['no-new-privileges:true']);
    });
});
