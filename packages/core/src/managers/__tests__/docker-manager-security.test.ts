import { describe, test, expect } from 'bun:test';
import { buildContainerCreateOptions } from '../docker-manager';

describe('docker-manager security', () => {
    test('drops all Linux capabilities', () => {
        const config = buildContainerCreateOptions({
            name: 'test-container',
            image: 'test-image',
            worktreePath: '/tmp/test-worktree',
        });

        expect(config.HostConfig.CapDrop).toEqual(['ALL']);
    });

    test('sets no-new-privileges security option', () => {
        const config = buildContainerCreateOptions({
            name: 'test-container',
            image: 'test-image',
            worktreePath: '/tmp/test-worktree',
        });

        expect(config.HostConfig.SecurityOpt).toEqual(['no-new-privileges:true']);
    });

    test('security options are present alongside other HostConfig settings', () => {
        const config = buildContainerCreateOptions({
            name: 'test-container',
            image: 'test-image',
            worktreePath: '/tmp/test-worktree',
            ports: [{ host: 3000, container: 3000, protocol: 'tcp' as const }],
            additionalBinds: ['/host/path:/container/path'],
        });

        expect(config.HostConfig.CapDrop).toEqual(['ALL']);
        expect(config.HostConfig.SecurityOpt).toEqual(['no-new-privileges:true']);
        expect(config.HostConfig.AutoRemove).toBe(false);
        expect(config.HostConfig.Binds).toEqual([
            '/tmp/test-worktree:/workspace',
            '/host/path:/container/path',
        ]);
        expect(config.HostConfig.PortBindings).toEqual({
            '3000/tcp': [{ HostPort: '3000' }],
        });
    });
});
