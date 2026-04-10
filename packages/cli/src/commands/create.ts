import { Command } from 'commander';
import chalk from 'chalk';
import * as clack from '@clack/prompts';
import { viwo, GitManager, type WorktreeSession } from '@viwo/core';
import { preflightChecksOrExit } from '../utils/prerequisites';
import { selectAndOpenIDE } from '../utils/ide-selector';
import { launchAgentForSession } from '../utils/agent-launch';
import { getStatusBadge } from '../utils/formatters';

const printWorkspaceDetails = (workspace: WorktreeSession) => {
    console.log();
    console.log(chalk.bold('Workspace Details'));
    console.log();
    console.log(`  ${chalk.cyan('ID:')}         ${workspace.id}`);
    console.log(`  ${chalk.cyan('Branch:')}     ${workspace.branchName}`);
    console.log(`  ${chalk.cyan('Worktree:')}   ${workspace.worktreePath}`);
    console.log(`  ${chalk.cyan('Status:')}     ${getStatusBadge(workspace.status)}`);
    console.log();
};

const runPostCreateActions = async (workspace: WorktreeSession): Promise<void> => {
    while (true) {
        const action = await clack.select({
            message: 'Workspace ready. What would you like to do?',
            options: [
                { label: 'Start agent', value: 'start-agent' },
                { label: 'Open in IDE', value: 'open-ide' },
                { label: 'Delete workspace', value: 'delete' },
                { label: 'Exit', value: 'exit' },
            ],
        });

        if (clack.isCancel(action) || action === 'exit') {
            return;
        }

        if (action === 'start-agent') {
            const spinner = clack.spinner();
            try {
                spinner.start('Starting agent...');
                await launchAgentForSession({
                    sessionId: workspace.id,
                    worktreePath: workspace.worktreePath,
                    repoPath: workspace.repoPath,
                    agent: workspace.agent.type,
                });
                spinner.stop('Agent started successfully!');
                const updated = await viwo.get(workspace.id);
                if (updated?.containerName) {
                    console.log();
                    console.log(chalk.dim('Container is running in the background.'));
                    console.log();
                    console.log(`  Attach:  ${chalk.cyan(`viwo attach ${updated.id}`)}`);
                    console.log(`  Detach:  ${chalk.dim('Ctrl+B, D (inside tmux)')}`);
                    console.log();
                }
                return;
            } catch (error) {
                spinner.stop(
                    error instanceof Error ? error.message : 'Failed to start agent.'
                );
            }
            continue;
        }

        if (action === 'open-ide') {
            await selectAndOpenIDE(workspace.worktreePath);
            continue;
        }

        if (action === 'delete') {
            const confirmDelete = await clack.select({
                message: chalk.red(
                    `Are you sure you want to delete workspace ${workspace.id.substring(0, 12)}?`
                ),
                options: [
                    { label: 'No, cancel', value: false },
                    { label: 'Yes, delete', value: true },
                ],
            });

            if (clack.isCancel(confirmDelete) || !confirmDelete) {
                continue;
            }

            await viwo.cleanup({
                sessionId: workspace.id,
                removeWorktree: true,
                stopContainers: true,
                removeContainers: true,
            });
            clack.log.success('Workspace deleted successfully.');
            return;
        }
    }
};

export const createCommand = new Command('create')
    .description('Create a new workspace without starting an AI agent')
    .option('-r, --repo <id>', 'Repository ID to use')
    .option('-b, --branch <branch>', 'Custom branch name')
    .option('-e, --env <path>', 'Path to .env file to copy')
    .option('--no-sync', 'Skip syncing Docker state before creating')
    .action(async (options) => {
        try {
            await preflightChecksOrExit({ requireDocker: false });

            if (options.sync !== false) {
                try {
                    await viwo.sync();
                } catch {
                    // Workspace creation should still work when Docker is unavailable.
                }
            }

            const nonInteractive = Boolean(options.repo);

            clack.intro(chalk.bgCyan(' viwo create '));

            let repoId: number;
            if (options.repo) {
                repoId = parseInt(options.repo, 10);
                if (isNaN(repoId)) {
                    clack.cancel('Invalid repository ID');
                    process.exit(1);
                }
            } else {
                const repositories = viwo.repo.list({ archived: false, orderByRecentlyUsed: true });

                if (repositories.length === 0) {
                    clack.cancel('No repositories found.');
                    console.log();
                    console.log(chalk.yellow('Add a repository first:'));
                    console.log(chalk.gray('  viwo repo add <path> --name <name>'));
                    console.log();
                    process.exit(1);
                }

                const selectedRepo = await clack.select({
                    message: 'Select a repository',
                    options: repositories.map((repo) => ({
                        label: repo.name,
                        value: repo.id,
                        hint: repo.path,
                    })),
                });

                if (clack.isCancel(selectedRepo)) {
                    clack.cancel('Operation cancelled.');
                    process.exit(0);
                }

                repoId = selectedRepo;
            }

            let branchName: string | undefined = options.branch;
            if (branchName) {
                const validationError = GitManager.validateBranchName(branchName);
                if (validationError) {
                    clack.log.error(chalk.red(validationError));
                    process.exit(1);
                }
            } else if (!nonInteractive) {
                const branchInput = await clack.text({
                    message: 'Branch name',
                    placeholder: 'Leave empty for auto-generated',
                    validate: (value) => {
                        if (!value || !value.trim()) return undefined;
                        return GitManager.validateBranchName(value.trim());
                    },
                });

                if (clack.isCancel(branchInput)) {
                    clack.cancel('Operation cancelled.');
                    process.exit(0);
                }

                if (branchInput && branchInput.trim()) {
                    branchName = branchInput.trim();
                }
            }

            const spinner = clack.spinner();
            spinner.start('Creating workspace...');

            const result = await viwo.createWorktree({
                repoId,
                branchName,
                envFile: options.env,
            });

            const workspace = await viwo.get(String(result.sessionId));
            if (!workspace) {
                throw new Error('Workspace created but could not be loaded.');
            }

            spinner.stop('Workspace created successfully!');
            printWorkspaceDetails(workspace);

            if (nonInteractive) {
                console.log(chalk.dim('Workspace is ready.'));
                console.log();
                console.log(chalk.gray('Next steps:'));
                console.log(`  Browse workspaces: ${chalk.cyan('viwo list')}`);
                console.log(`  Start agent:       ${chalk.cyan('viwo list')}`);
                console.log(`  Delete workspace:  ${chalk.cyan('viwo clean')}`);
                console.log();
                clack.outro('Workspace ready!');
                return;
            }

            await runPostCreateActions(workspace);
            clack.outro('Workspace ready!');
        } catch (error) {
            clack.cancel(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });
