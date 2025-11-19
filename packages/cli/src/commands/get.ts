import { Command } from 'commander';
import chalk from 'chalk';
import { viwo } from '@viwo/core';
import { getStatusBadge } from '../utils/formatters';

export const getCommand = new Command('get')
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
                        container.ports.map((p: { host: number; container: number }) => `${p.host}:${p.container}`).join(', ')
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
