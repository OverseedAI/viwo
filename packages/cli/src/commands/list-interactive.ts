import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { SessionStatus, viwo, type WorktreeSession } from '@viwo/core';
import { getStatusBadge, formatDate } from '../utils/formatters';
import { checkPrerequisitesOrExit } from '../utils/prerequisites';
import { selectAndOpenIDE } from '../utils/ide-selector';

const displaySessionDetails = async (session: WorktreeSession) => {
    console.clear();
    console.log();
    console.log(chalk.bold.cyan('Session Details'));
    console.log(chalk.gray('═'.repeat(70)));
    console.log();
    console.log(chalk.bold('General'));
    console.log(chalk.gray('  ID:              '), session.id);
    console.log(chalk.gray('  Status:          '), getStatusBadge(session.status));
    console.log(chalk.gray('  Created:         '), formatDate(session.createdAt));
    console.log(chalk.gray('  Last Activity:   '), formatDate(session.lastActivity));
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
                container.ports
                    .map((p: { host: number; container: number }) => `${p.host}:${p.container}`)
                    .join(', ')
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
};

const handleSessionAction = async (session: WorktreeSession): Promise<'back' | 'exit'> => {
    const actions = [
        {
            name: `📂 Open worktree in terminal (${session.worktreePath})`,
            value: 'cd',
            disabled: !session.worktreePath,
        },
        {
            name: '💻 Open in IDE',
            value: 'open-ide',
            disabled: !session.worktreePath,
        },
        {
            name: '🗑️  Delete session',
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
        case 'cd':
            console.log();
            console.log(chalk.cyan('To navigate to the worktree, run:'));
            console.log(chalk.yellow(`  cd ${session.worktreePath}`));
            console.log();
            console.log(chalk.gray('Press Enter to continue...'));
            await new Promise((resolve) => {
                process.stdin.once('data', resolve);
            });
            return 'back';

        case 'open-ide':
            await selectAndOpenIDE(session.worktreePath);
            console.log(chalk.gray('Press Enter to continue...'));
            await new Promise((resolve) => {
                process.stdin.once('data', resolve);
            });
            return 'back';

        case 'delete': {
            console.log();
            const confirmDelete = await select({
                message: chalk.red(
                    `Are you sure you want to delete session ${session.id.substring(0, 12)}?`
                ),
                choices: [
                    { name: 'No, cancel', value: false },
                    { name: 'Yes, delete', value: true },
                ],
            });

            if (confirmDelete) {
                try {
                    await viwo.cleanup({
                        sessionId: session.id,
                        removeWorktree: true,
                        stopContainers: true,
                        removeContainers: true,
                    });
                    console.log(chalk.green('✓ Session deleted successfully'));
                    console.log();
                    console.log(chalk.gray('Press Enter to continue...'));
                    await new Promise((resolve) => {
                        process.stdin.once('data', resolve);
                    });
                } catch (error) {
                    console.error(
                        chalk.red('Failed to delete session:'),
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

export const runInteractiveList = async (options: { status?: SessionStatus; limit?: number }) => {
    try {
        // Enable raw mode for better input handling
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }

        while (true) {
            // Check prerequisites before syncing
            // Sync Docker state with database before listing
            if (options.status === undefined || options.limit === undefined) {
                await checkPrerequisitesOrExit({ requireGit: false });
                await viwo.sync();
            }

            const sessions = await viwo.list({
                status: options.status,
                limit: options.limit,
            });

            if (sessions.length === 0) {
                console.clear();
                console.log();
                console.log(chalk.yellow('No sessions found.'));
                console.log(
                    chalk.gray('Create a new session with: ') +
                        chalk.cyan('viwo start --prompt "your task"')
                );
                console.log();
                break;
            }

            console.clear();
            console.log();
            console.log(chalk.bold.cyan('VIWO Sessions'));
            console.log(chalk.gray('Use arrow keys to navigate, Enter to select'));
            console.log();

            const choices = sessions.map((session) => ({
                name: `${getStatusBadge(session.status)} ${session.branchName.padEnd(40)} ${chalk.gray(formatDate(session.createdAt))}`,
                value: session.id,
                description: `${session.agent.type} | ${session.id.substring(0, 12)}`,
            }));

            choices.push({
                name: chalk.gray('─'.repeat(70)),
                value: '__separator__',
                description: '',
            });

            choices.push({
                name: chalk.gray('❌ Exit'),
                value: '__exit__',
                description: 'Exit interactive mode',
            });

            const selectedId = await select({
                message: `Select a session (${sessions.length} total):`,
                choices,
                pageSize: 15,
            });

            if (selectedId === '__exit__') {
                break;
            }

            if (selectedId === '__separator__') {
                continue;
            }

            // Fetch the full session details
            const session = await viwo.get(selectedId);

            if (!session) {
                console.log(chalk.red('Session not found'));
                continue;
            }

            // Display session details
            await displaySessionDetails(session);

            // Show action options
            const result = await handleSessionAction(session);

            if (result === 'exit') {
                break;
            }
        }

        console.log(chalk.gray('Goodbye! 👋'));
        console.log();
    } catch (error) {
        if ((error as any).name === 'ExitPromptError') {
            // User pressed Ctrl+C
            console.log();
            console.log(chalk.gray('Goodbye! 👋'));
            console.log();
            process.exit(0);
        }
        throw error;
    }
};
