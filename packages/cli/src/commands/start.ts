import { Command } from 'commander';
import chalk from 'chalk';
import * as clack from '@clack/prompts';
import { viwo, AttachManager } from '@viwo/core';
import { getStatusBadge } from '../utils/formatters';
import { preflightChecksOrExit } from '../utils/prerequisites';
import { multilineInput } from '../utils/multiline-input';

export const startCommand = new Command('start')
    .description('Initialize a new worktree session with an AI agent')
    .option('-r, --repo <id>', 'Repository ID to use')
    .option('-a, --agent <agent>', 'AI agent to use', 'claude-code')
    .option('-b, --branch <branch>', 'Custom branch name')
    .option('-c, --compose <path>', 'Path to docker-compose.yml')
    .option('-e, --env <path>', 'Path to .env file to copy')
    .option('-s, --setup <commands...>', 'Setup commands to run')
    .option('--no-sync', 'Skip syncing Docker state before starting')
    .action(async (options) => {
        try {
            // Run preflight checks before proceeding
            await preflightChecksOrExit();

            // Sync Docker state with database before starting
            if (options.sync !== false) {
                await viwo.sync();
            }

            clack.intro(chalk.bgCyan(' viwo start '));

            // Step 1: Select repository
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

            // Step 2: Get branch name
            let branchName: string | undefined = options.branch;

            if (!branchName) {
                const branchInput = await clack.text({
                    message: 'Branch name',
                    placeholder: 'Leave empty for auto-generated',
                });

                if (clack.isCancel(branchInput)) {
                    clack.cancel('Operation cancelled.');
                    process.exit(0);
                }

                if (branchInput && branchInput.trim()) {
                    branchName = branchInput.trim();
                }
            }

            // Step 3: Get prompt
            const prompt = await multilineInput({
                message: 'Enter your prompt for the AI agent:',
            });

            // Create session
            const spinner = clack.spinner();
            spinner.start('Initializing worktree session...');

            const session = await viwo.start({
                repoId,
                prompt,
                agent: options.agent,
                branchName,
                dockerCompose: options.compose,
                envFile: options.env,
                setupCommands: options.setup,
            });

            spinner.stop('Session created successfully!');

            console.log();
            console.log(chalk.bold('Session Details'));
            console.log();
            console.log(`  ${chalk.cyan('ID:')}        ${session.id}`);
            console.log(`  ${chalk.cyan('Branch:')}    ${session.branchName}`);
            console.log(`  ${chalk.cyan('Worktree:')}  ${session.worktreePath}`);
            console.log(`  ${chalk.cyan('Agent:')}     ${session.agent.type}`);
            console.log(`  ${chalk.cyan('Status:')}    ${getStatusBadge(session.status)}`);

            // Attach to container and stream output
            const dbSession = await viwo.get(session.id);

            if (dbSession && dbSession.containers.length > 0) {
                console.log();
                console.log(chalk.dim('───────────────────────────────────────────────────────'));
                console.log(
                    chalk.cyan.bold('Claude Code Output') +
                        chalk.dim(' (Press Ctrl+C to detach, container will keep running)')
                );
                console.log(chalk.dim('───────────────────────────────────────────────────────'));
                console.log();

                try {
                    // Attach to container and wait for user to press Ctrl+C
                    await AttachManager.attachAndWaitForDetach({
                        containerId: dbSession.containers[0].id,
                    });

                    console.log();
                    console.log(
                        chalk.dim('───────────────────────────────────────────────────────')
                    );
                    console.log(chalk.yellow('Detached from container'));
                    console.log(
                        chalk.dim(
                            `Container ${dbSession.containers[0].id} is still running in the background`
                        )
                    );
                    console.log(
                        chalk.dim('───────────────────────────────────────────────────────')
                    );
                    console.log();
                    clack.outro(`Next: ${chalk.cyan(`cd "${session.worktreePath}"`)} to view results!`);
                    process.exit(0);
                } catch (attachError) {
                    console.error(
                        chalk.yellow('\nFailed to attach to container:'),
                        attachError instanceof Error ? attachError.message : String(attachError)
                    );
                    console.log();
                    clack.outro(`Next: ${chalk.cyan(`cd "${session.worktreePath}"`)} to view results!`);
                    process.exit(0);
                }
            }
        } catch (error) {
            clack.cancel(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });
