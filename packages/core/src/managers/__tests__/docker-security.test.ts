import { describe, test, expect } from 'bun:test';
import { buildContainerHostConfig } from '../docker-manager';

describe('container security hardening', () => {
    test('drops all Linux capabilities', () => {
        const hostConfig = buildContainerHostConfig({
            worktreePath: '/tmp/test-workspace',
        });

        expect(hostConfig.CapDrop).toEqual(['ALL']);
    });

    test('sets no-new-privileges security option', () => {
        const hostConfig = buildContainerHostConfig({
            worktreePath: '/tmp/test-workspace',
        });

        expect(hostConfig.SecurityOpt).toEqual(['no-new-privileges:true']);
    });

    test('preserves binds and port mappings alongside security options', () => {
        const hostConfig = buildContainerHostConfig({
            worktreePath: '/tmp/test-workspace',
            additionalBinds: ['/host/path:/container/path'],
            ports: [{ host: 8080, container: 80, protocol: 'tcp' as const }],
        });

        expect(hostConfig.Binds).toEqual([
            '/tmp/test-workspace:/workspace',
            '/host/path:/container/path',
        ]);
        expect(hostConfig.PortBindings).toEqual({
            '80/tcp': [{ HostPort: '8080' }],
        });
        expect(hostConfig.AutoRemove).toBe(false);
        expect(hostConfig.CapDrop).toEqual(['ALL']);
        expect(hostConfig.SecurityOpt).toEqual(['no-new-privileges:true']);
    });

    test('omits PortBindings when no ports provided', () => {
        const hostConfig = buildContainerHostConfig({
            worktreePath: '/workspace',
        });

        expect(hostConfig.PortBindings).toBeUndefined();
    });
});
