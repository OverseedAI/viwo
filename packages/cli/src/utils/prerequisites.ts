import chalk from 'chalk';
import { viwo } from '@viwo/core';
import { $ } from 'bun';

/**
 * Check if git is installed on the system
 */
export const isGitInstalled = async (): Promise<boolean> => {
    try {
        await $`git --version`.quiet();
        return true;
    } catch {
        return false;
    }
};

/**
 * Check if Docker daemon is running
 */
export const isDockerRunning = async (): Promise<boolean> => {
    return await viwo.docker.isDockerRunning();
};

export interface PrerequisiteCheckResult {
    gitInstalled: boolean;
    dockerRunning: boolean;
}

/**
 * Check all prerequisites (git and Docker)
 */
export const checkPrerequisites = async (): Promise<PrerequisiteCheckResult> => {
    const [gitInstalled, dockerRunning] = await Promise.all([
        isGitInstalled(),
        isDockerRunning(),
    ]);

    return { gitInstalled, dockerRunning };
};

export interface PrerequisiteOptions {
    requireGit?: boolean;
    requireDocker?: boolean;
}

/**
 * Check prerequisites and show friendly error messages if requirements are not met.
 * Exits the process if any required prerequisite is missing.
 */
export const checkPrerequisitesOrExit = async (
    options: PrerequisiteOptions = {}
): Promise<void> => {
    const { requireGit = true, requireDocker = true } = options;

    const { gitInstalled, dockerRunning } = await checkPrerequisites();

    const missing: string[] = [];

    if (requireGit && !gitInstalled) {
        missing.push('Git');
    }

    if (requireDocker && !dockerRunning) {
        missing.push('Docker');
    }

    if (missing.length === 0) {
        return;
    }

    // Show friendly error message
    console.log();
    console.log(chalk.red('✗ Missing Requirements'));
    console.log();
    console.log(
        chalk.yellow(
            `VIWO requires ${missing.join(' and ')} to be ${missing.length === 1 ? 'available' : 'running'}.`
        )
    );
    console.log();

    if (!gitInstalled) {
        console.log(chalk.cyan('Git:'));
        console.log(
            chalk.gray(
                '  Git is not installed or not available in your PATH. Please install Git:'
            )
        );
        console.log(chalk.gray('  → https://git-scm.com/downloads'));
        console.log();
    }

    if (!dockerRunning) {
        console.log(chalk.cyan('Docker:'));
        console.log(
            chalk.gray('  Docker daemon is not running. Please start Docker Desktop or Docker Engine:')
        );
        console.log(chalk.gray('  → https://docs.docker.com/get-docker/'));
        console.log();
    }

    process.exit(1);
};
