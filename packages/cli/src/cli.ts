#!/usr/bin/env bun

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { viwo, WorktreeSession } from '@viwo/core';
import path from 'path';

const program = new Command();

program
    .name('viwo')
    .description('AI-powered development environment orchestrator')
    .version('0.1.0');

/**
 * Init command - Create a new worktree session
 */
program
    .command('init')
    .description('Initialize a new worktree session with an AI agent')
    .argument('[repo-path]', 'Path to git repository', process.cwd())
    .requiredOption('-p, --prompt <prompt>', 'Initial prompt for the AI agent')
    .option('-a, --agent <agent>', 'AI agent to use', 'claude-code')
    .option('-b, --branch <branch>', 'Custom branch name')
    .option('-c, --compose <path>', 'Path to docker-compose.yml')
    .option('-e, --env <path>', 'Path to .env file to copy')
    .option('-s, --setup <commands...>', 'Setup commands to run')
    .action(async (repoPath: string, options) => {
        const spinner = ora('Initializing worktree session...').start();

        try {
            const session = await viwo.init({
                repoPath: path.resolve(repoPath),
                prompt: options.prompt,
                agent: options.agent,
                branchName: options.branch,
                dockerCompose: options.compose,
                envFile: options.env,
                setupCommands: options.setup,
            });

            spinner.succeed('Session created successfully!');

            console.log();
            console.log(chalk.bold('Session Details:'));
            console.log(chalk.gray('─'.repeat(50)));
            console.log(chalk.cyan('ID:           '), session.id);
            console.log(chalk.cyan('Branch:       '), session.branchName);
            console.log(chalk.cyan('Worktree:     '), session.worktreePath);
            console.log(chalk.cyan('Agent:        '), session.agent.type);
            console.log(chalk.cyan('Status:       '), getStatusBadge(session.status));
            console.log(chalk.gray('─'.repeat(50)));
            console.log();
            console.log(chalk.bold('Next Steps:'));
            console.log(chalk.gray('  1. ') + `cd ${session.worktreePath}`);
            console.log(chalk.gray('  2. ') + 'Start coding with your AI agent!');
            console.log(chalk.gray('  3. ') + `viwo cleanup ${session.id} when done`);
            console.log();
        } catch (error) {
            spinner.fail('Failed to create session');
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
            process.exit(1);
        }
    });

/**
 * List command - Show all sessions
 */
program
    .command('list')
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

/**
 * Get command - Show details of a specific session
 */
program
    .command('get')
    .description('Get details of a specific session')
    .argument('<session-id>', 'Session ID')
    .action(async (sessionId: string) => {
        try {
            const session = await viwo.get(sessionId);

            if (!session) {
                console.log(chalk.red(`Session not found: ${sessionId}`));
                process.exit(1);
            }

            console.log();
            console.log(chalk.bold.cyan('Session Details'));
            console.log(chalk.gray('═'.repeat(70)));
            console.log();
            console.log(chalk.bold('General'));
            console.log(chalk.gray('  ID:              '), session.id);
            console.log(chalk.gray('  Status:          '), getStatusBadge(session.status));
            console.log(chalk.gray('  Created:         '), session.createdAt.toLocaleString());
            console.log(chalk.gray('  Last Activity:   '), session.lastActivity.toLocaleString());
            console.log();
            console.log(chalk.bold('Repository'));
            console.log(chalk.gray('  Path:            '), session.repoPath);
            console.log(chalk.gray('  Branch:          '), session.branchName);
            console.log(chalk.gray('  Worktree:        '), session.worktreePath);
            console.log();
            console.log(chalk.bold('Agent'));
            console.log(chalk.gray('  Type:            '), session.agent.type);
            console.log(chalk.gray('  Prompt:          '), session.agent.initialPrompt);
            console.log();

            if (session.containers.length > 0) {
                console.log(chalk.bold('Containers'));
                for (const container of session.containers) {
                    console.log(chalk.gray(`  ${container.name}:`));
                    console.log(chalk.gray('    Status:        '), container.status);
                    console.log(
                        chalk.gray('    Ports:         '),
                        container.ports.map((p) => `${p.host}:${p.container}`).join(', ')
                    );
                }
                console.log();
            }

            if (session.error) {
                console.log(chalk.bold.red('Error'));
                console.log(chalk.gray('  '), session.error);
                console.log();
            }

            console.log(chalk.gray('═'.repeat(70)));
            console.log();
        } catch (error) {
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
            process.exit(1);
        }
    });

/**
 * Cleanup command - Remove a session
 */
program
    .command('cleanup')
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

/**
 * Helper functions
 */
function getStatusBadge(status: WorktreeSession['status']): string {
    switch (status) {
        case 'initializing':
            return chalk.yellow('⏳ initializing');
        case 'running':
            return chalk.green('✓ running');
        case 'stopped':
            return chalk.gray('■ stopped');
        case 'error':
            return chalk.red('✗ error');
        case 'cleaned':
            return chalk.gray('○ cleaned');
        default:
            return status;
    }
}

function formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
}

// Parse command line arguments
program.parse();
