import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { viwo } from '@viwo/core';
import { basename } from 'node:path';
import { preflightChecksOrExit } from '../utils/prerequisites';
import { runInteractiveRepoList } from './repo-list-interactive';

export const repoCommand = new Command('repo').description('Manage repositories');

/**
 * List repositories
 */
repoCommand
    .command('list')
    .description('List all repositories')
    .option('--json', 'Output as JSON (non-interactive)')
    .option('--plain', 'Output as plain text (non-interactive)')
    .action(async (options) => {
        try {
            // Non-interactive output modes
            if (options.json || options.plain) {
                await preflightChecksOrExit({ requireDocker: false });
                const repositories = viwo.repo.list({});

                if (options.json) {
                    console.log(JSON.stringify(repositories, null, 2));
                    return;
                }

                // Plain text
                if (repositories.length === 0) {
                    console.log('No repositories found.');
                    return;
                }

                for (const repo of repositories) {
                    console.log(
                        [repo.id, repo.name, repo.path, repo.defaultBranch ?? ''].join('\t')
                    );
                }
                return;
            }

            // Interactive path
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
        // Run preflight checks before proceeding
        await preflightChecksOrExit({ requireDocker: false });

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
        await preflightChecksOrExit({ requireDocker: false });

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
