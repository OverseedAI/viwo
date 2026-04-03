import { select, Separator } from '@inquirer/prompts';
import chalk from 'chalk';
import { viwo, GitManager } from '@viwo/core';
import { formatDate } from '../utils/formatters';
import { selectAndOpenIDE } from '../utils/ide-selector';

// Infer Repository type from viwo.repo.list return type
type Repository = ReturnType<typeof viwo.repo.list>[number];

const displayRepositoryDetails = (repo: Repository) => {
    console.clear();
    console.log();
    console.log(chalk.bold.cyan('Repository Details'));
    console.log(chalk.gray('═'.repeat(70)));
    console.log();
    console.log(chalk.bold('General'));
    console.log(chalk.gray('  ID:              '), repo.id);
    console.log(chalk.gray('  Name:            '), repo.name);
    console.log(chalk.gray('  Path:            '), repo.path);
    if (repo.defaultBranch) {
        console.log(chalk.gray('  Default Branch:  '), chalk.green(repo.defaultBranch));
    }
    if (repo.url) {
        console.log(chalk.gray('  URL:             '), repo.url);
    }
    if (repo.createdAt) {
        console.log(chalk.gray('  Created:         '), formatDate(new Date(repo.createdAt)));
    }
    console.log();
    console.log(chalk.gray('═'.repeat(70)));
    console.log();
};

const handleRepositoryAction = async (repo: Repository): Promise<'back' | 'exit'> => {
    const actions = [
        {
            name: '💻 Open in IDE',
            value: 'open-ide',
        },
        {
            name: `🌿 Set default branch${repo.defaultBranch ? chalk.gray(` (${repo.defaultBranch})`) : ''}`,
            value: 'set-branch',
        },
        {
            name: '🗑️  Delete repository',
            value: 'delete',
        },
        {
            name: '🔙 Go back to list',
            value: 'back',
        },
        {
            name: '❌ Exit',
            value: 'exit',
        },
    ];

    const action = await select({
        message: 'What would you like to do?',
        choices: actions,
    });

    switch (action) {
        case 'open-ide':
            await selectAndOpenIDE(repo.path);
            console.log(chalk.gray('Press Enter to continue...'));
            await new Promise((resolve) => {
                process.stdin.once('data', resolve);
            });
            return 'back';

        case 'set-branch': {
            try {
                const branches = await GitManager.getBranches({ repoPath: repo.path });
                const localBranches = branches.filter((b) => !b.startsWith('remotes/'));

                const branchChoices = localBranches.map((b) => ({
                    name: b === repo.defaultBranch ? `${b} ${chalk.green('(current)')}` : b,
                    value: b,
                }));

                if (repo.defaultBranch) {
                    branchChoices.push({
                        name: chalk.yellow('Clear default branch'),
                        value: '__clear__',
                    });
                }

                branchChoices.push({
                    name: chalk.gray('Cancel'),
                    value: '__cancel__',
                });

                const selectedBranch = await select({
                    message: 'Select default branch for new worktrees:',
                    choices: branchChoices,
                    pageSize: 15,
                });

                if (selectedBranch === '__cancel__') {
                    return 'back';
                }

                if (selectedBranch === '__clear__') {
                    viwo.repo.deleteDefaultBranch({ id: repo.id });
                    console.log(chalk.green('✓ Default branch cleared'));
                } else {
                    viwo.repo.setDefaultBranch({ id: repo.id, branch: selectedBranch });
                    console.log(chalk.green(`✓ Default branch set to "${selectedBranch}"`));
                }

                console.log();
                console.log(chalk.gray('Press Enter to continue...'));
                await new Promise((resolve) => {
                    process.stdin.once('data', resolve);
                });
            } catch (error) {
                console.error(
                    chalk.red('Failed to set default branch:'),
                    error instanceof Error ? error.message : String(error)
                );
                console.log();
                console.log(chalk.gray('Press Enter to continue...'));
                await new Promise((resolve) => {
                    process.stdin.once('data', resolve);
                });
            }
            return 'back';
        }

        case 'delete': {
            console.log();
            const confirmDelete = await select({
                message: chalk.red(
                    `Are you sure you want to delete repository "${repo.name}"? This only removes it from VIWO, not from disk.`
                ),
                choices: [
                    { name: 'No, cancel', value: false },
                    { name: 'Yes, delete', value: true },
                ],
            });

            if (confirmDelete) {
                try {
                    viwo.repo.delete({ id: repo.id });
                    console.log(chalk.green('✓ Repository deleted successfully'));
                    console.log();
                    console.log(chalk.gray('Press Enter to continue...'));
                    await new Promise((resolve) => {
                        process.stdin.once('data', resolve);
                    });
                } catch (error) {
                    console.error(
                        chalk.red('Failed to delete repository:'),
                        error instanceof Error ? error.message : String(error)
                    );
                    console.log();
                    console.log(chalk.gray('Press Enter to continue...'));
                    await new Promise((resolve) => {
                        process.stdin.once('data', resolve);
                    });
                }
            }
            return 'back';
        }

        case 'back':
            return 'back';

        case 'exit':
            return 'exit';

        default:
            return 'back';
    }
};

export const runInteractiveRepoList = async () => {
    try {
        // Enable raw mode for better input handling
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }

        while (true) {
            const repositories = viwo.repo.list({});

            if (repositories.length === 0) {
                console.clear();
                console.log();
                console.log(chalk.yellow('No repositories found.'));
                console.log(
                    chalk.gray('Add a repository with: ') + chalk.cyan('viwo repo add [path]')
                );
                console.log();
                break;
            }

            console.clear();
            console.log();
            console.log(chalk.bold.cyan('VIWO Repositories'));
            console.log(chalk.gray('Use arrow keys to navigate, Enter to select'));
            console.log();

            const repoChoices = repositories.map((repo) => ({
                name: `${repo.name.padEnd(30)} ${chalk.gray(repo.path)}`,
                value: repo.id,
                description: repo.createdAt
                    ? `Created: ${formatDate(new Date(repo.createdAt))}`
                    : `ID: ${repo.id}`,
            }));

            const selectedId = await select({
                message: `Select a repository (${repositories.length} total):`,
                choices: [
                    ...repoChoices,
                    new Separator(chalk.gray('─'.repeat(70))),
                    {
                        name: chalk.gray('➕ Add new repository'),
                        value: -888888,
                        description: 'Add a new repository to VIWO',
                    },
                    {
                        name: chalk.gray('❌ Exit'),
                        value: -777777,
                        description: 'Exit interactive mode',
                    },
                ],
                pageSize: 15,
            });

            if (selectedId === -777777) {
                break;
            }

            if (selectedId === -888888) {
                console.log();
                console.log(chalk.cyan('To add a repository, run:'));
                console.log(chalk.yellow('  viwo repo add [path]'));
                console.log();
                console.log(chalk.gray('Press Enter to continue...'));
                await new Promise((resolve) => {
                    process.stdin.once('data', resolve);
                });
                continue;
            }

            // Fetch the repository by ID
            const repo = repositories.find((r) => r.id === selectedId);

            if (!repo) {
                console.log(chalk.red('Repository not found'));
                continue;
            }

            // Display repository details
            displayRepositoryDetails(repo);

            // Show action options
            const result = await handleRepositoryAction(repo);

            if (result === 'exit') {
                break;
            }
        }

        console.log(chalk.gray('Goodbye! 👋'));
        console.log();
    } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
            // User pressed Ctrl+C
            console.log();
            console.log(chalk.gray('Goodbye! 👋'));
            console.log();
            process.exit(0);
        }
        throw error;
    }
};
