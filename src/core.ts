import { $ } from 'bun';
import { join } from 'path';
import { WorktreeSchema, WorktreeListSchema, type Worktree, type WorktreeList } from './schemas.js';
import { getWorktreeForWorktree } from './worktree-manager.js';
import { getContainersForWorktree } from './container-manager.js';

async function isBareRepository(path: string = process.cwd()): Promise<boolean> {
    try {
        const result = await $`git rev-parse --is-bare-repository`.cwd(path).text();
        return result.trim() === 'true';
    } catch {
        return false;
    }
}

async function getGitWorktrees(
    searchPath?: string
): Promise<Array<{ path: string; branch: string; commit: string }>> {
    let workingDir = searchPath || process.cwd();

    // If current directory is not a bare repo, go up one directory
    if (!(await isBareRepository(workingDir))) {
        workingDir = join(workingDir, '..');
    }

    try {
        const result = await $`git worktree list --porcelain`.cwd(workingDir).text();

        const worktrees: Array<{ path: string; branch: string; commit: string }> = [];
        const lines = result.split('\n').filter((line: string) => line.trim());

        let currentWorktree: Partial<{ path: string; branch: string; commit: string }> = {};

        for (const line of lines) {
            if (line.startsWith('worktree ')) {
                if (currentWorktree.path) {
                    worktrees.push(
                        currentWorktree as { path: string; branch: string; commit: string }
                    );
                }
                currentWorktree = { path: line.substring(9) };
            } else if (line.startsWith('HEAD ')) {
                currentWorktree.commit = line.substring(5);
            } else if (line.startsWith('branch ')) {
                currentWorktree.branch = line.substring(7);
            }
        }

        if (currentWorktree.path) {
            worktrees.push(currentWorktree as { path: string; branch: string; commit: string });
        }

        return worktrees;
    } catch {
        return [];
    }
}

export async function listWorktrees(): Promise<WorktreeList> {
    const gitWorktrees = await getGitWorktrees();

    const worktreesWithStatus = await Promise.all(
        gitWorktrees.map(async (gitWorktree, index) => {
            const id = `worktree-${index}`;
            const baseName = gitWorktree.path.split('/').pop() || `worktree-${index}`;

            const baseWorktree: Partial<Worktree> = {
                id,
                name: baseName,
                path: gitWorktree.path,
                description: `Git worktree for branch ${gitWorktree.branch || 'detached'}`,
                tags: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const status = await getWorktreeStatus(id);
            return { ...baseWorktree, ...status };
        })
    );

    return WorktreeListSchema.parse(worktreesWithStatus);
}

export async function getWorktree(id: string): Promise<Worktree | null> {
    const worktrees = await listWorktrees();
    return worktrees.find(wt => wt.id === id) || null;
}

export async function validateWorktree(worktree: unknown): Promise<Worktree> {
    return WorktreeSchema.parse(worktree);
}

export async function getWorktreeStatus(id: string): Promise<{
    worktreePath?: string;
    worktreeBranch?: string;
    containerIds: string[];
    status: 'active' | 'inactive';
}> {
    const worktree = getWorktreeForWorktree(id);
    const containers = getContainersForWorktree(id);
    const activeContainerIds = containers.filter(c => c.status.includes('Up')).map(c => c.id);

    return {
        worktreePath: worktree?.path,
        worktreeBranch: worktree?.branch,
        containerIds: activeContainerIds,
        status: worktree || activeContainerIds.length > 0 ? 'active' : 'inactive',
    };
}
