import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { viwo } from '@viwo/core';

export const cleanupCommand = new Command('cleanup')
    .description('Cleanup a worktree session')
    .argument('<session-id>', 'Session ID to cleanup')
    .option('--keep-worktree', 'Keep the worktree directory')
    .option('--keep-containers', 'Keep containers running')
    .action(async (sessionId: string, options) => {
        const spinner = ora('Cleaning up session...').start();

        try {
            await viwo.cleanup({
                sessionId,
                removeWorktree: !options.keepWorktree,
                stopContainers: !options.keepContainers,
                removeContainers: !options.keepContainers,
            });

            spinner.succeed('Session cleaned up successfully!');
        } catch (error) {
            spinner.fail('Failed to cleanup session');
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
            process.exit(1);
        }
    });
