import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { viwo } from '@viwo/core';
import { getStatusBadge } from '../utils/formatters';

export const startCommand = new Command('start')
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
