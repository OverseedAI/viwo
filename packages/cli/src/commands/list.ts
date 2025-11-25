import { Command } from 'commander';
import chalk from 'chalk';
import { runInteractiveList } from './list-interactive';

export const listCommand = new Command('list')
    .description('List all worktree sessions')
    .option('-s, --status <status>', 'Filter by status')
    .option('-l, --limit <number>', 'Limit number of results', parseInt)
    .action(async (options) => {
        try {
            await runInteractiveList({
                status: options.status,
                limit: options.limit,
            });
        } catch (error) {
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
            process.exit(1);
        }
    });
