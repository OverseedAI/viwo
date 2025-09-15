import { describe, expect, it, test } from 'bun:test';
import { generateWorktreeName, parseWorktreeName } from '../src/worktree-manager';

describe('worktree manager', () => {
    it('generates and parses worktree names', () => {
        const name = generateWorktreeName('abc123', 'main');
        expect(name).toBe('viwo-abc123-main');
        expect(parseWorktreeName(name)).toEqual({ worktreeId: 'abc123', branch: 'main' });
    });
});

test.todo('createWorktree executes git worktree add');
test.todo('removeWorktree executes git worktree remove');
test.todo('listExistingWorktrees parses git output');
