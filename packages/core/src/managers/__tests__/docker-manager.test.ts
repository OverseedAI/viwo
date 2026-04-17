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
        test('drops all Linux capabilities', () => {
            const config = buildContainerConfig({
                name: 'test',
                image: 'test-image',
                worktreePath: '/tmp/test',
            });

            expect(config.HostConfig.CapDrop).toEqual(['ALL']);
        });

        test('sets no-new-privileges security option', () => {
            const config = buildContainerConfig({
                name: 'test',
                image: 'test-image',
                worktreePath: '/tmp/test',
            });

            expect(config.HostConfig.SecurityOpt).toEqual(['no-new-privileges:true']);
        });

        test('includes workspace and additional bind mounts', () => {
            const config = buildContainerConfig({
                name: 'test',
                image: 'test-image',
                worktreePath: '/tmp/test',
                additionalBinds: ['/host:/container'],
            });

            expect(config.HostConfig.Binds).toEqual(['/tmp/test:/workspace', '/host:/container']);
        });

        test('sets port bindings when ports are provided', () => {
            const config = buildContainerConfig({
                name: 'test',
                image: 'test-image',
                worktreePath: '/tmp/test',
                ports: [{ host: 8080, container: 80, protocol: 'tcp' }],
            });

            expect(config.ExposedPorts).toEqual({ '80/tcp': {} });
            expect(config.HostConfig.PortBindings).toEqual({
                '80/tcp': [{ HostPort: '8080' }],
            });
        });

        test('converts env record to Docker format', () => {
            const config = buildContainerConfig({
                name: 'test',
                image: 'test-image',
                worktreePath: '/tmp/test',
                env: { FOO: 'bar', BAZ: 'qux' },
            });

            expect(config.Env).toEqual(['FOO=bar', 'BAZ=qux']);
        });

        test('applies tty and openStdin options', () => {
            const config = buildContainerConfig({
                name: 'test',
                image: 'test-image',
                worktreePath: '/tmp/test',
                tty: true,
                openStdin: true,
            });

            expect(config.Tty).toBe(true);
            expect(config.OpenStdin).toBe(true);
        });
    });
});
