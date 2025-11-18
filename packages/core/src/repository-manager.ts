import { simpleGit, SimpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';

export class RepositoryManager {
    private git: SimpleGit;

    constructor(private repoPath: string) {
        this.git = simpleGit(repoPath);
    }

    async isValidRepository(): Promise<boolean> {
        try {
            await this.git.status();
            return true;
        } catch (error) {
            return false;
        }
    }

    async getCurrentBranch(): Promise<string> {
        const status = await this.git.status();
        return status.current || 'main';
    }

    async generateBranchName(baseName?: string): Promise<string> {
        const timestamp = new Date().toISOString().split('T')[0];
        const shortId = nanoid(6);

        if (baseName) {
            // Sanitize branch name
            const sanitized = baseName
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');

            return `${sanitized}-${timestamp}-${shortId}`;
        }

        return `viwo-${timestamp}-${shortId}`;
    }

    async createWorktree(branchName: string, worktreePath: string): Promise<void> {
        // Ensure worktrees directory exists
        const worktreesDir = path.dirname(worktreePath);
        if (!fs.existsSync(worktreesDir)) {
            fs.mkdirSync(worktreesDir, { recursive: true });
        }

        // Create new branch and worktree
        await this.git.raw(['worktree', 'add', '-b', branchName, worktreePath]);
    }

    async removeWorktree(worktreePath: string): Promise<void> {
        try {
            // Remove the worktree
            await this.git.raw(['worktree', 'remove', worktreePath, '--force']);
        } catch (error) {
            // If the worktree doesn't exist in git, just remove the directory
            if (fs.existsSync(worktreePath)) {
                fs.rmSync(worktreePath, { recursive: true, force: true });
            }
        }
    }

    async listWorktrees(): Promise<Array<{ path: string; branch: string; commit: string }>> {
        const output = await this.git.raw(['worktree', 'list', '--porcelain']);
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
    }

    async hasUncommittedChanges(worktreePath: string): Promise<boolean> {
        const git = simpleGit(worktreePath);
        const status = await git.status();
        return !status.isClean();
    }

    async copyEnvFile(sourceEnvPath: string, targetPath: string): Promise<void> {
        if (fs.existsSync(sourceEnvPath)) {
            const targetEnvPath = path.join(targetPath, path.basename(sourceEnvPath));
            fs.copyFileSync(sourceEnvPath, targetEnvPath);
        }
    }
}
