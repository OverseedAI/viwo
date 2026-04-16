import { describe, test, expect } from 'bun:test';
import { buildContainerConfig } from '../docker-manager';

describe('docker-manager security hardening', () => {
    test('drops all Linux capabilities', () => {
        const config = buildContainerConfig({
            name: 'test-container',
            image: 'test-image:latest',
            worktreePath: '/tmp/test-worktree',
        });

        expect(config.HostConfig.CapDrop).toEqual(['ALL']);
    });

    test('sets no-new-privileges security option', () => {
        const config = buildContainerConfig({
            name: 'test-container',
            image: 'test-image:latest',
            worktreePath: '/tmp/test-worktree',
        });

        expect(config.HostConfig.SecurityOpt).toEqual(['no-new-privileges:true']);
    });

    test('includes security options alongside other HostConfig settings', () => {
        const config = buildContainerConfig({
            name: 'test-container',
            image: 'test-image:latest',
            worktreePath: '/tmp/test-worktree',
            additionalBinds: ['/host/path:/container/path'],
        });

        expect(config.HostConfig.Binds).toContain('/tmp/test-worktree:/workspace');
        expect(config.HostConfig.Binds).toContain('/host/path:/container/path');
        expect(config.HostConfig.AutoRemove).toBe(false);
        expect(config.HostConfig.CapDrop).toEqual(['ALL']);
        expect(config.HostConfig.SecurityOpt).toEqual(['no-new-privileges:true']);
    });

    test('includes port bindings alongside security options', () => {
        const config = buildContainerConfig({
            name: 'test-container',
            image: 'test-image:latest',
            worktreePath: '/tmp/test-worktree',
            ports: [{ host: 8080, container: 80, protocol: 'tcp' }],
        });

        expect(config.HostConfig.PortBindings).toEqual({
            '80/tcp': [{ HostPort: '8080' }],
        });
        expect(config.HostConfig.CapDrop).toEqual(['ALL']);
        expect(config.HostConfig.SecurityOpt).toEqual(['no-new-privileges:true']);
    });
});
