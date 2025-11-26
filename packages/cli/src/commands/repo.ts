import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { viwo } from '@viwo/core';
import { basename } from 'node:path';
import { checkPrerequisitesOrExit } from '../utils/prerequisites';
import { runInteractiveRepoList } from './repo-list-interactive';

export const repoCommand = new Command('repo').description('Manage repositories');

/**
 * List repositories
 */
repoCommand
    .command('list')
    .description('List all repositories')
    .action(async () => {
        try {
            await runInteractiveRepoList();
        } catch (error) {
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
            process.exit(1);
        }
    });

/**
 * Add a repository
 */
repoCommand
    .command('add')
    .description('Add a new repository')
    .argument('[path]', 'Path to the git repository (defaults to current directory)', process.cwd())
    .option('-n, --name <name>', 'Custom name for the repository')
    .action(async (repoPath: string, options) => {
        // Check prerequisites before proceeding
        await checkPrerequisitesOrExit({ requireDocker: false });

        const spinner = ora('Adding repository...').start();
        const possiblyRelativePath = repoPath === '.' ? process.cwd() : repoPath;
        const lastBitOfPath = basename(possiblyRelativePath);
        // Get the last directory name of a path
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

/**
 * Delete a repository
 */
repoCommand
    .command('delete')
    .description('Delete a repository')
    .argument('<id>', 'Repository ID to delete')
    .option('-f, --force', 'Skip confirmation')
    .action(async (id: string, _options) => {
        const spinner = ora('Deleting repository...').start();

        try {
            viwo.repo.delete({ id: Number(id) });

            spinner.succeed('Repository deleted successfully!');
        } catch (error) {
            spinner.fail('Failed to delete repository');
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
            process.exit(1);
        }
    });
