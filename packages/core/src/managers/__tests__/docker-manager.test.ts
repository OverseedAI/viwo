import { describe, test, expect } from 'bun:test';
import { isDockerRunning, buildContainerHostConfig } from '../docker-manager';

describe('docker-manager', () => {
    describe('isDockerRunning', () => {
        test('checks if Docker is running', async () => {
            const running = await isDockerRunning();
            expect(typeof running).toBe('boolean');
        });
    });

    describe('buildContainerHostConfig', () => {
        test('drops all Linux capabilities', () => {
            const { hostConfig } = buildContainerHostConfig({
                name: 'test',
                image: 'test:latest',
                worktreePath: '/tmp/worktree',
            });

            expect(hostConfig.CapDrop).toEqual(['ALL']);
        });

        test('sets no-new-privileges security option', () => {
            const { hostConfig } = buildContainerHostConfig({
                name: 'test',
                image: 'test:latest',
                worktreePath: '/tmp/worktree',
            });

            expect(hostConfig.SecurityOpt).toEqual(['no-new-privileges:true']);
        });

        test('includes workspace bind mount and additional binds', () => {
            const { hostConfig } = buildContainerHostConfig({
                name: 'test',
                image: 'test:latest',
                worktreePath: '/tmp/worktree',
                additionalBinds: ['/host:/container', '/a:/b:ro'],
            });

            expect(hostConfig.Binds).toEqual([
                '/tmp/worktree:/workspace',
                '/host:/container',
                '/a:/b:ro',
            ]);
        });

        test('creates port bindings from port mappings', () => {
            const { hostConfig, exposedPorts } = buildContainerHostConfig({
                name: 'test',
                image: 'test:latest',
                worktreePath: '/tmp/worktree',
                ports: [{ host: 3000, container: 8080, protocol: 'tcp' }],
            });

            expect(exposedPorts).toEqual({ '8080/tcp': {} });
            expect(hostConfig.PortBindings).toEqual({
                '8080/tcp': [{ HostPort: '3000' }],
            });
        });

        test('omits port bindings when no ports specified', () => {
            const { hostConfig, exposedPorts } = buildContainerHostConfig({
                name: 'test',
                image: 'test:latest',
                worktreePath: '/tmp/worktree',
            });

            expect(exposedPorts).toEqual({});
            expect(hostConfig.PortBindings).toBeUndefined();
        });

        test('disables auto-remove', () => {
            const { hostConfig } = buildContainerHostConfig({
                name: 'test',
                image: 'test:latest',
                worktreePath: '/tmp/worktree',
            });

            expect(hostConfig.AutoRemove).toBe(false);
        });
    });
});
