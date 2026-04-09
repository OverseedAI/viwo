import { Command } from 'commander';
import chalk from 'chalk';
import { viwo } from '@viwo/core';
import { preflightChecksOrExit } from '../utils/prerequisites';
import { runInteractiveList } from './list-interactive';

export const listCommand = new Command('list')
    .description('List all worktree sessions')
    .option('-s, --status <status>', 'Filter by status')
    .option('-l, --limit <number>', 'Limit number of results', parseInt)
    .option('--json', 'Output as JSON (non-interactive)')
    .action(async (options) => {
        try {
            if (options.json) {
                await preflightChecksOrExit({ requireGit: false });
                await viwo.sync();

                const sessions = await viwo.list({
                    status: options.status,
                    limit: options.limit,
                });

                console.log(JSON.stringify(sessions, null, 2));
                return;
            }

            await runInteractiveList({
                status: options.status,
                limit: options.limit,
            });
        } catch (error) {
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
            process.exit(1);
        }
    });
