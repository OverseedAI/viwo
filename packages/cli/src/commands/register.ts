import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { viwo } from '@viwo/core';
import { basename } from 'node:path';

/**
 * Register command - alias for 'repo add'
 */
export const registerCommand = new Command('register')
    .description('Add a new repository (alias for "repo add")')
    .argument('<path>', 'Path to the git repository')
    .option('-n, --name <name>', 'Custom name for the repository')
    .action(async (repoPath: string, options) => {
        const spinner = ora('Adding repository...').start();
        const possiblyRelativePath = repoPath === '.' ? process.cwd() : repoPath;
        const lastBitOfPath = basename(possiblyRelativePath);

        try {
            const repo = await viwo.repo.create({
                path: possiblyRelativePath,
                name: options.name ?? lastBitOfPath,
            });

            spinner.succeed('Repository added successfully!');

            console.log();
            console.log(chalk.bold('Repository Details:'));
            console.log(chalk.gray(' '.repeat(50)));
            console.log(chalk.cyan('ID:       '), repo.id);
            console.log(chalk.cyan('Name:     '), repo.name);
            console.log(chalk.cyan('Path:     '), repo.path);
            console.log(chalk.gray(' '.repeat(50)));
            console.log();
        } catch (error) {
            spinner.fail('Failed to add repository');
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
            process.exit(1);
        }
    });
