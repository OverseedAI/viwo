import { simpleGit } from 'simple-git';
import path from 'path';
import { mkdir, exists, rm } from 'node:fs/promises';
import { nanoid } from 'nanoid';

export interface RepoPathOptions {
    repoPath: string;
}

export const isValidRepository = async (options: RepoPathOptions): Promise<boolean> => {
    try {
        const gitInstance = simpleGit(options.repoPath);
        await gitInstance.status();
        return true;
    } catch (error) {
        return false;
    }
};

export const checkValidRepositoryOrThrow = async (options: RepoPathOptions): Promise<void> => {
    /* Throws if path is not valid. */
    const isValid = await isValidRepository(options);

    if (!isValid) {
        throw Error(options.repoPath + ' is not a valid git repository.');
    }
};

export const getCurrentBranch = async (options: RepoPathOptions): Promise<string> => {
    const gitInstance = simpleGit(options.repoPath);
    const status = await gitInstance.status();
    return status.current || 'main';
};

export interface GenerateBranchNameOptions {
    baseName?: string;
}

export const generateBranchName = async (
    options: GenerateBranchNameOptions = {}
): Promise<string> => {
    const timestamp = new Date().toISOString().split('T')[0];
    const shortId = nanoid(6);

    if (options.baseName) {
        // Sanitize branch name
        const sanitized = options.baseName
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        return `${sanitized}-${timestamp}-${shortId}`;
    }

    return `viwo-${timestamp}-${shortId}`;
};

export interface CreateWorktreeOptions {
    repoPath: string;
    branchName: string;
    worktreePath: string;
}

export const createWorktree = async (options: CreateWorktreeOptions): Promise<void> => {
    const gitInstance = simpleGit(options.repoPath);

    // Ensure worktrees directory exists
    const worktreesDir = path.dirname(options.worktreePath);
    if (!(await exists(worktreesDir))) {
        await mkdir(worktreesDir, { recursive: true });
    }

    // Create new branch and worktree
    await gitInstance.raw(['worktree', 'add', '-b', options.branchName, options.worktreePath]);
};

export interface RemoveWorktreeOptions {
    repoPath: string;
    worktreePath: string;
}

export const removeWorktree = async (options: RemoveWorktreeOptions): Promise<void> => {
    const gitInstance = simpleGit(options.repoPath);

    try {
        // Remove the worktree
        await gitInstance.raw(['worktree', 'remove', options.worktreePath, '--force']);
    } catch (error) {
        // If the worktree doesn't exist in git, just remove the directory
        if (await exists(options.worktreePath)) {
            await rm(options.worktreePath, { recursive: true, force: true });
        }
    }
};

export const listWorktrees = async (
    options: RepoPathOptions
): Promise<Array<{ path: string; branch: string; commit: string }>> => {
    const gitInstance = simpleGit(options.repoPath);
    const output = await gitInstance.raw(['worktree', 'list', '--porcelain']);
    const worktrees: Array<{ path: string; branch: string; commit: string }> = [];

    const lines = output.split('\n');
    let current: any = {};

    for (const line of lines) {
        if (line.startsWith('worktree ')) {
            current.path = line.substring('worktree '.length);
        } else if (line.startsWith('branch ')) {
            current.branch = line.substring('branch '.length).replace('refs/heads/', '');
        } else if (line.startsWith('HEAD ')) {
            current.commit = line.substring('HEAD '.length);
        } else if (line === '' && current.path) {
            worktrees.push(current);
            current = {};
        }
    }

    return worktrees;
};

export interface WorktreePathOptions {
    worktreePath: string;
}

export const hasUncommittedChanges = async (options: WorktreePathOptions): Promise<boolean> => {
    const gitInstance = simpleGit(options.worktreePath);
    const status = await gitInstance.status();
    return !status.isClean();
};

export interface CopyEnvFileOptions {
    sourceEnvPath: string;
    targetPath: string;
}

export const copyEnvFile = async (options: CopyEnvFileOptions): Promise<void> => {
    if (await exists(options.sourceEnvPath)) {
        const targetEnvPath = path.join(options.targetPath, path.basename(options.sourceEnvPath));
        const sourceFile = Bun.file(options.sourceEnvPath);
        await Bun.write(targetEnvPath, sourceFile);
    }
};

export const pruneWorktrees = async (options: RepoPathOptions): Promise<void> => {
    const gitInstance = simpleGit(options.repoPath);
    await gitInstance.raw(['worktree', 'prune']);
};

export interface DeleteBranchOptions {
    repoPath: string;
    branchName: string;
    force?: boolean;
}

export const deleteBranch = async (options: DeleteBranchOptions): Promise<void> => {
    const gitInstance = simpleGit(options.repoPath);
    try {
        // Delete the local branch
        const flag = options.force ? '-D' : '-d';
        await gitInstance.raw(['branch', flag, options.branchName]);
    } catch (error) {
        // If branch doesn't exist or can't be deleted, log warning but don't fail
        console.warn(`Failed to delete branch ${options.branchName}:`, error);
    }
};

export const git = {
    isValidRepository,
    checkValidRepositoryOrThrow,
    getCurrentBranch,
    generateBranchName,
    createWorktree,
    removeWorktree,
    listWorktrees,
    hasUncommittedChanges,
    copyEnvFile,
    pruneWorktrees,
    deleteBranch,
};
