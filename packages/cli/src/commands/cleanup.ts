import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { viwo } from '@viwo/core';
import { checkPrerequisitesOrExit } from '../utils/prerequisites';

export const cleanupCommand = new Command('cleanup')
    .description('Cleanup a worktree session')
    .argument('<session-id>', 'Session ID to cleanup')
    .option('--keep-worktree', 'Keep the worktree directory')
    .option('--keep-containers', 'Keep containers running')
    .option('--no-sync', 'Skip syncing Docker state before cleanup')
    .action(async (sessionId: string, options) => {
        try {
            // Check prerequisites before proceeding
            await checkPrerequisitesOrExit();

            const spinner = ora('Syncing and cleaning up session...').start();

            // Sync Docker state with database before cleanup
            if (options.sync !== false) {
                await viwo.sync();
            }

            spinner.text = 'Cleaning up session...';

            await viwo.cleanup({
                sessionId,
                removeWorktree: !options.keepWorktree,
                stopContainers: !options.keepContainers,
                removeContainers: !options.keepContainers,
            });

            spinner.succeed('Session cleaned up successfully!');
        } catch (error) {
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
            process.exit(1);
        }
    });
