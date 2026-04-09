import chalk from 'chalk';
import { viwo } from '@viwo/core';
import { $ } from 'bun';
import packageJson from '../../package.json';

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

/**
 * Compare two semantic version strings
 * Returns true if current version is less than latest version
 */
export const isVersionOutdated = (current: string, latest: string): boolean => {
    const parseVersion = (v: string) => {
        const parts = v.replace(/^v/, '').split('.').map(Number);
        return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
    };

    const currentParts = parseVersion(current);
    const latestParts = parseVersion(latest);

    if (currentParts.major !== latestParts.major) {
        return currentParts.major < latestParts.major;
    }
    if (currentParts.minor !== latestParts.minor) {
        return currentParts.minor < latestParts.minor;
    }
    return currentParts.patch < latestParts.patch;
};

export interface ReleaseInfo {
    version: string;
    releaseNotes: string | null;
}

/**
 * Truncate release notes to a brief summary for display
 */
export const formatReleaseNotes = (body: string, maxLines = 10): string => {
    const lines = body.split('\n').filter((line) => line.trim() !== '');
    const truncated = lines.slice(0, maxLines);
    let summary = truncated.join('\n');
    if (lines.length > maxLines) {
        summary += '\n  ...';
    }
    return summary;
};

/**
 * Fetch the latest release info from GitHub releases
 */
const getLatestRelease = async (): Promise<ReleaseInfo | null> => {
    try {
        const response = await fetch(
            'https://api.github.com/repos/OverseedAI/viwo/releases/latest'
        );
        if (!response.ok) {
            return null;
        }
        const data = (await response.json()) as { tag_name?: string; body?: string };
        const tagName = data.tag_name || null;
        if (!tagName) {
            return null;
        }
        return {
            version: tagName.replace(/^v/, ''),
            releaseNotes: data.body || null,
        };
    } catch {
        return null;
    }
};

/**
 * Check if the current viwo CLI version is outdated
 * Returns release info if outdated, null otherwise
 */
export const checkVersion = async (): Promise<ReleaseInfo | null> => {
    const currentVersion = packageJson.version;
    const release = await getLatestRelease();

    if (!release) {
        return null;
    }

    if (isVersionOutdated(currentVersion, release.version)) {
        return release;
    }

    return null;
};

export interface PreflightCheckResult {
    gitInstalled: boolean;
    dockerRunning: boolean;
    latestRelease: ReleaseInfo | null;
}

/**
 * Check all preflight requirements (git, Docker, and version)
 */
export const preflightChecks = async (): Promise<PreflightCheckResult> => {
    const [gitInstalled, dockerRunning, latestRelease] = await Promise.all([
        isGitInstalled(),
        isDockerRunning(),
        checkVersion(),
    ]);

    return { gitInstalled, dockerRunning, latestRelease };
};

export interface PrerequisiteOptions {
    requireGit?: boolean;
    requireDocker?: boolean;
}

/**
 * Run preflight checks and show friendly error messages if requirements are not met.
 * Exits the process if any required prerequisite is missing.
 * Shows a warning if a newer version is available.
 * Runs database migrations to ensure the database is up to date.
 */
export const preflightChecksOrExit = async (options: PrerequisiteOptions = {}): Promise<void> => {
    const { requireGit = true, requireDocker = true } = options;

    // Run database migrations first to ensure DB is up to date
    try {
        await viwo.migrate();
    } catch (error) {
        console.error(
            chalk.red('Database migration failed:'),
            error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
    }

    const { gitInstalled, dockerRunning, latestRelease } = await preflightChecks();

    const missing: string[] = [];

    if (requireGit && !gitInstalled) {
        missing.push('Git');
    }

    if (requireDocker && !dockerRunning) {
        missing.push('Docker');
    }

    // Show version update warning if available (non-blocking)
    if (latestRelease) {
        console.log();
        console.log(chalk.yellow('⚠ Update Available'));
        console.log();
        console.log(
            chalk.gray(
                `  A new version of VIWO is available: ${chalk.cyan(`v${latestRelease.version}`)} (current: ${chalk.gray(`v${packageJson.version}`)})`
            )
        );

        // Show changelog summary if release notes are available
        if (latestRelease.releaseNotes) {
            console.log();
            console.log(chalk.gray('  Changelog:'));
            const summary = formatReleaseNotes(latestRelease.releaseNotes);
            for (const line of summary.split('\n')) {
                console.log(chalk.gray(`  ${line}`));
            }
        }

        console.log();
        console.log(chalk.gray('  Update by running the install script:'));

        // Show OS-specific install command
        const platform = process.platform;
        if (platform === 'win32') {
            console.log(
                chalk.cyan(
                    '  irm https://raw.githubusercontent.com/OverseedAI/viwo/main/install.ps1 | iex'
                )
            );
        } else {
            // macOS and Linux
            console.log(
                chalk.cyan(
                    '  curl -fsSL https://raw.githubusercontent.com/OverseedAI/viwo/main/install.sh | bash'
                )
            );
        }

        console.log();
        console.log(chalk.gray('  Or download from:'));
        console.log(chalk.cyan('  https://github.com/OverseedAI/viwo/releases/latest'));
        console.log();
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
            chalk.gray('  Git is not installed or not available in your PATH. Please install Git:')
        );
        console.log(chalk.gray('  → https://git-scm.com/downloads'));
        console.log();
    }

    if (!dockerRunning) {
        console.log(chalk.cyan('Docker:'));
        console.log(
            chalk.gray(
                '  Docker daemon is not running. Please start Docker Desktop or Docker Engine:'
            )
        );
        console.log(chalk.gray('  → https://docs.docker.com/get-docker/'));
        console.log();
    }

    process.exit(1);
};
