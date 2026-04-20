import { describe, test, expect } from 'bun:test';
import { isDockerRunning, buildContainerConfig } from '../docker-manager';

describe('docker-manager', () => {
    describe('isDockerRunning', () => {
        test('checks if Docker is running', async () => {
            const running = await isDockerRunning();
            expect(typeof running).toBe('boolean');
        });
    });

    describe('buildContainerConfig', () => {
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

        test('mounts worktree at /workspace', () => {
            const config = buildContainerConfig(baseOptions);
            expect(config.HostConfig.Binds).toContain('/tmp/test-worktree:/workspace');
        });

        test('includes additional binds', () => {
            const config = buildContainerConfig({
                ...baseOptions,
                additionalBinds: ['/host/path:/container/path'],
            });
            expect(config.HostConfig.Binds).toContain('/host/path:/container/path');
        });

        test('maps port bindings', () => {
            const config = buildContainerConfig({
                ...baseOptions,
                ports: [{ host: 8080, container: 80, protocol: 'tcp' as const }],
            });
            expect(config.HostConfig.PortBindings).toEqual({
                '80/tcp': [{ HostPort: '8080' }],
            });
            expect(config.ExposedPorts).toEqual({ '80/tcp': {} });
        });

        test('sets environment variables', () => {
            const config = buildContainerConfig({
                ...baseOptions,
                env: { FOO: 'bar', BAZ: 'qux' },
            });
            expect(config.Env).toEqual(['FOO=bar', 'BAZ=qux']);
        });

        test('disables auto-remove', () => {
            const config = buildContainerConfig(baseOptions);
            expect(config.HostConfig.AutoRemove).toBe(false);
        });
    });
});
