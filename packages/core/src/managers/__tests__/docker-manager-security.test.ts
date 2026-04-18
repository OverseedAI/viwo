import { describe, test, expect } from 'bun:test';
import { buildContainerConfig } from '../docker-manager';

describe('docker-manager security hardening', () => {
    test('drops all Linux capabilities', () => {
        const config = buildContainerConfig({
            name: 'test-security',
            image: 'test-image:latest',
            worktreePath: '/tmp/test-worktree',
        });

        expect(config.HostConfig.CapDrop).toEqual(['ALL']);
    });

    test('sets no-new-privileges security option', () => {
        const config = buildContainerConfig({
            name: 'test-security',
            image: 'test-image:latest',
            worktreePath: '/tmp/test-worktree',
        });

        expect(config.HostConfig.SecurityOpt).toEqual(['no-new-privileges:true']);
    });

    test('preserves existing HostConfig options alongside security settings', () => {
        const config = buildContainerConfig({
            name: 'test-security',
            image: 'test-image:latest',
            worktreePath: '/tmp/test-worktree',
            additionalBinds: ['/host/path:/container/path'],
            ports: [{ container: 3000, host: 3000, protocol: 'tcp' }],
        });

        expect(config.HostConfig.Binds).toContain('/tmp/test-worktree:/workspace');
        expect(config.HostConfig.Binds).toContain('/host/path:/container/path');
        expect(config.HostConfig.AutoRemove).toBe(false);
        expect(config.HostConfig.CapDrop).toEqual(['ALL']);
        expect(config.HostConfig.SecurityOpt).toEqual(['no-new-privileges:true']);
        expect(config.HostConfig.PortBindings).toBeDefined();
    });

    test('sets correct port bindings', () => {
        const config = buildContainerConfig({
            name: 'test',
            image: 'test:latest',
            worktreePath: '/tmp/w',
            ports: [
                { container: 8080, host: 9090, protocol: 'tcp' },
                { container: 5432, host: 5432, protocol: 'tcp' },
            ],
        });

        expect(config.HostConfig.PortBindings!['8080/tcp']).toEqual([{ HostPort: '9090' }]);
        expect(config.HostConfig.PortBindings!['5432/tcp']).toEqual([{ HostPort: '5432' }]);
    });

    test('converts env record to Docker format', () => {
        const config = buildContainerConfig({
            name: 'test',
            image: 'test:latest',
            worktreePath: '/tmp/w',
            env: { FOO: 'bar', BAZ: 'qux' },
        });

        expect(config.Env).toContain('FOO=bar');
        expect(config.Env).toContain('BAZ=qux');
    });
});
