import { describe, expect, it, test } from 'bun:test';
import { generateContainerName, parseContainerName } from '../src/container-manager';

describe('container manager', () => {
    it('generates and parses container names', () => {
        const name = generateContainerName('abc123', 'dev');
        const parsed = parseContainerName(name);
        expect(parsed?.worktreeId).toBe('abc123');
        expect(parsed?.serviceType).toBe('dev');
    });
});

test.todo('createContainer runs docker command');
test.todo('listWorktreeContainers parses docker output');
