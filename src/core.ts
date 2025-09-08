import {
  WorktreeSchema,
  WorktreeListSchema,
  type Worktree,
  type WorktreeList,
} from './schemas.js';
import { getWorktreeForWorktree } from './worktree-manager.js';
import { getContainersForWorktree } from './container-manager.js';

// TODO: Define actual worktrees data source
const hardcodedWorktrees: Worktree[] = [];

export async function listWorktrees(): Promise<WorktreeList> {
  const worktreesWithStatus = await Promise.all(
    hardcodedWorktrees.map(async worktree => {
      const status = await getWorktreeStatus(worktree.id);
      return { ...worktree, ...status };
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
  const activeContainerIds = containers
    .filter(c => c.status.includes('Up'))
    .map(c => c.id);

  return {
    worktreePath: worktree?.path,
    worktreeBranch: worktree?.branch,
    containerIds: activeContainerIds,
    status: worktree || activeContainerIds.length > 0 ? 'active' : 'inactive',
  };
}
