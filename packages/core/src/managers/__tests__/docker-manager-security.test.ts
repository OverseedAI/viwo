import { describe, test, expect } from 'bun:test';
import { buildContainerConfig } from '../docker-manager';

describe('docker-manager security', () => {
    const baseOptions = {
        name: 'test-container',
        image: 'test-image:latest',
        worktreePath: '/tmp/test-worktree',
    };

    test('drops all Linux capabilities', () => {
        const config = buildContainerConfig(baseOptions);
        expect(config.HostConfig.CapDrop).toEqual(['ALL']);
    });

    test('sets no-new-privileges security option', () => {
        const config = buildContainerConfig(baseOptions);
        expect(config.HostConfig.SecurityOpt).toEqual(['no-new-privileges:true']);
    });

    test('includes workspace bind mount', () => {
        const config = buildContainerConfig(baseOptions);
        expect(config.HostConfig.Binds).toContain('/tmp/test-worktree:/workspace');
    });

    test('includes additional bind mounts', () => {
        const config = buildContainerConfig({
            ...baseOptions,
            additionalBinds: ['/host/path:/container/path:ro'],
        });
        expect(config.HostConfig.Binds).toEqual([
            '/tmp/test-worktree:/workspace',
            '/host/path:/container/path:ro',
        ]);
    });

    test('builds port bindings correctly', () => {
        const config = buildContainerConfig({
            ...baseOptions,
            ports: [{ host: 8080, container: 80, protocol: 'tcp' as const }],
        });
        expect(config.HostConfig.PortBindings).toEqual({
            '80/tcp': [{ HostPort: '8080' }],
        });
    });
});
