import { execSync } from 'child_process';
import { join } from 'path';

export interface WorktreeInfo {
    path: string;
    branch: string;
    worktreeId: string;
}

export function generateWorktreeName(worktreeId: string, branch: string): string {
    const sanitizedBranch = branch.replace(/[^a-zA-Z0-9-]/g, '-');
    const sanitizedId = worktreeId.replace(/[^a-zA-Z0-9-]/g, '-');
    return `viwo-${sanitizedId}-${sanitizedBranch}`;
}

export function parseWorktreeName(name: string): { worktreeId: string; branch: string } | null {
    const match = name.match(/^viwo-(.+)-(.+)$/);
    if (!match) return null;

    const [, worktreeId, branch] = match;
    return { worktreeId, branch };
}

export function listExistingWorktrees(worktreeId?: string): WorktreeInfo[] {
    try {
        const output = execSync('git worktree list --porcelain', {
            encoding: 'utf-8',
            stdio: 'pipe',
        });

        const worktrees: WorktreeInfo[] = [];
        const lines = output.split('\n').filter(line => line.trim());

        let currentWorktree: Partial<WorktreeInfo> = {};

        for (const line of lines) {
            if (line.startsWith('worktree ')) {
                if (currentWorktree.path && currentWorktree.branch && currentWorktree.worktreeId) {
                    worktrees.push(currentWorktree as WorktreeInfo);
                }
                currentWorktree = { path: line.substring(9) };
            } else if (line.startsWith('branch ')) {
                const branch = line.substring(7);
                const folderName = currentWorktree.path?.split('/').pop() || '';
                const parsed = parseWorktreeName(folderName);

                if (parsed && (!worktreeId || parsed.worktreeId === worktreeId)) {
                    currentWorktree.branch = branch;
                    currentWorktree.worktreeId = parsed.worktreeId;
                }
            }
        }

        if (currentWorktree.path && currentWorktree.branch && currentWorktree.worktreeId) {
            worktrees.push(currentWorktree as WorktreeInfo);
        }

        return worktrees;
    } catch (error) {
        return [];
    }
}

export function createWorktree(
    worktreeId: string,
    sourcePath: string,
    branch: string,
    targetDir?: string
): string {
    const worktreeName = generateWorktreeName(worktreeId, branch);
    const worktreePath = targetDir ? join(targetDir, worktreeName) : join('..', worktreeName);

    try {
        execSync(`git worktree add "${worktreePath}" "${branch}"`, {
            cwd: sourcePath,
            stdio: 'pipe',
        });

        return worktreePath;
    } catch (error) {
        throw new Error(
            `Failed to create worktree: ${error instanceof Error ? error.message : error}`
        );
    }
}

export function removeWorktree(worktreePath: string): void {
    try {
        execSync(`git worktree remove "${worktreePath}"`, { stdio: 'pipe' });
    } catch (error) {
        execSync(`git worktree remove --force "${worktreePath}"`, {
            stdio: 'pipe',
        });
    }
}

export function getWorktreeForWorktree(worktreeId: string): WorktreeInfo | null {
    const worktrees = listExistingWorktrees(worktreeId);
    return worktrees.length > 0 ? worktrees[0] : null;
}
