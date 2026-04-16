import { describe, test, expect } from 'bun:test';
import { buildContainerHostConfig } from '../docker-manager';

describe('docker-manager security hardening', () => {
    test('drops all Linux capabilities', () => {
        const config = buildContainerHostConfig({
            name: 'test',
            image: 'test:latest',
            worktreePath: '/tmp/worktree',
        });

        expect(config.CapDrop).toEqual(['ALL']);
    });

    test('sets no-new-privileges', () => {
        const config = buildContainerHostConfig({
            name: 'test',
            image: 'test:latest',
            worktreePath: '/tmp/worktree',
        });

        expect(config.SecurityOpt).toEqual(['no-new-privileges:true']);
    });

    test('preserves bind mounts and port bindings alongside security options', () => {
        const config = buildContainerHostConfig({
            name: 'test',
            image: 'test:latest',
            worktreePath: '/tmp/worktree',
            additionalBinds: ['/host:/container'],
            ports: [{ container: 8080, host: 3000, protocol: 'tcp' }],
        });

        expect(config.Binds).toEqual(['/tmp/worktree:/workspace', '/host:/container']);
        expect(config.PortBindings).toEqual({ '8080/tcp': [{ HostPort: '3000' }] });
        expect(config.AutoRemove).toBe(false);
        expect(config.CapDrop).toEqual(['ALL']);
        expect(config.SecurityOpt).toEqual(['no-new-privileges:true']);
    });
});
