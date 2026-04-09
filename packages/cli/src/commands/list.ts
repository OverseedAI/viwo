import { Command } from 'commander';
import chalk from 'chalk';
import { viwo } from '@viwo/core';
import { runInteractiveList } from './list-interactive';
import { preflightChecksOrExit } from '../utils/prerequisites';

const runPlainList = async (options: { status?: string; limit?: number; json?: boolean }) => {
    await preflightChecksOrExit({ requireGit: false });
    await viwo.sync();

    const sessions = await viwo.list({
        status: options.status as any,
        limit: options.limit,
    });

    if (options.json) {
        console.log(JSON.stringify(sessions, null, 2));
        return;
    }

    // Plain text table output
    if (sessions.length === 0) {
        console.log('No sessions found.');
        return;
    }

    for (const session of sessions) {
        console.log(
            [
                session.id,
                session.status,
                session.branchName,
                session.agent.type,
                session.repoPath,
            ].join('\t')
        );
    }
};

export const listCommand = new Command('list')
    .description('List all worktree sessions')
    .option('-s, --status <status>', 'Filter by status')
    .option('-l, --limit <number>', 'Limit number of results', parseInt)
    .option('--json', 'Output as JSON (non-interactive)')
    .option('--plain', 'Output as plain text (non-interactive)')
    .action(async (options) => {
        try {
            // Non-interactive output modes
            if (options.json || options.plain) {
                await runPlainList({
                    status: options.status,
                    limit: options.limit,
                    json: options.json,
                });
                return;
            }

            // Interactive path
            await runInteractiveList({
                status: options.status,
                limit: options.limit,
            });
        } catch (error) {
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
            process.exit(1);
        }
    });
