import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { viwo } from '@viwo/core';
import { getStatusBadge, formatDate } from '../utils/formatters';

export const listCommand = new Command('list')
    .description('List all worktree sessions')
    .option('-s, --status <status>', 'Filter by status')
    .option('-l, --limit <number>', 'Limit number of results', parseInt)
    .action(async (options) => {
        try {
            const sessions = await viwo.list({
                status: options.status,
                limit: options.limit,
            });

            if (sessions.length === 0) {
                console.log(chalk.yellow('No sessions found.'));
                console.log(
                    chalk.gray('Create a new session with: ') +
                        chalk.cyan('viwo init --prompt "your task"')
                );
                return;
            }

            const table = new Table({
                head: [
                    chalk.cyan('ID'),
                    chalk.cyan('Branch'),
                    chalk.cyan('Agent'),
                    chalk.cyan('Status'),
                    chalk.cyan('Created'),
                ],
                colWidths: [15, 30, 15, 15, 20],
            });

            for (const session of sessions) {
                table.push([
                    session.id.substring(0, 12) + '...',
                    session.branchName,
                    session.agent.type,
                    getStatusBadge(session.status),
                    formatDate(session.createdAt),
                ]);
            }

            console.log();
            console.log(table.toString());
            console.log();
            console.log(
                chalk.gray(`Total: ${sessions.length} session${sessions.length !== 1 ? 's' : ''}`)
            );
            console.log();
        } catch (error) {
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
            process.exit(1);
        }
    });
