import { describe, test, expect, mock, beforeEach } from 'bun:test';

let capturedCreateContainerArgs: Record<string, unknown> | null = null;

const mockInspect = mock(() => ({
    Id: 'test-container-id',
    Name: '/test-container',
    State: { Status: 'created', Running: false, ExitCode: 0 },
    Created: new Date().toISOString(),
}));

const mockCreateContainer = mock(async (opts: Record<string, unknown>) => {
    capturedCreateContainerArgs = opts;
    return { inspect: mockInspect };
});

const mockGetImage = mock(() => ({ inspect: mock(async () => ({})) }));

mock.module('dockerode', () => ({
    default: class {
        createContainer = mockCreateContainer;
        getImage = mockGetImage;
        ping = mock(async () => 'OK');
    },
}));

const { createContainer } = await import('../docker-manager');

describe('docker-manager security hardening', () => {
    beforeEach(() => {
        capturedCreateContainerArgs = null;
    });

    test('drops all Linux capabilities', async () => {
        await createContainer({
            name: 'test-security',
            image: 'test-image:latest',
            worktreePath: '/tmp/test-worktree',
        });

        expect(capturedCreateContainerArgs).not.toBeNull();
        expect(capturedCreateContainerArgs.HostConfig.CapDrop).toEqual(['ALL']);
    });

    test('sets no-new-privileges security option', async () => {
        await createContainer({
            name: 'test-security',
            image: 'test-image:latest',
            worktreePath: '/tmp/test-worktree',
        });

        expect(capturedCreateContainerArgs).not.toBeNull();
        expect(capturedCreateContainerArgs.HostConfig.SecurityOpt).toEqual([
            'no-new-privileges:true',
        ]);
    });

    test('preserves existing HostConfig options alongside security settings', async () => {
        await createContainer({
            name: 'test-security',
            image: 'test-image:latest',
            worktreePath: '/tmp/test-worktree',
            additionalBinds: ['/host/path:/container/path'],
        });

        const hostConfig = capturedCreateContainerArgs.HostConfig;
        expect(hostConfig.Binds).toContain('/tmp/test-worktree:/workspace');
        expect(hostConfig.Binds).toContain('/host/path:/container/path');
        expect(hostConfig.AutoRemove).toBe(false);
        expect(hostConfig.CapDrop).toEqual(['ALL']);
        expect(hostConfig.SecurityOpt).toEqual(['no-new-privileges:true']);
    });
});
