import { select, Separator } from '@inquirer/prompts';
import chalk from 'chalk';
import { SessionStatus, viwo, DockerManager, type WorktreeSession } from '@viwo/core';
import {
    getAgentStatusBadge,
    getCompositeStatusBadge,
    getStatusBadge,
    formatDate,
} from '../utils/formatters';
import { preflightChecksOrExit } from '../utils/prerequisites';
import { selectAndOpenIDE } from '../utils/ide-selector';
import { launchAgentForSession } from '../utils/agent-launch';
import { execSync } from 'child_process';

const getContainerName = (session: WorktreeSession): string =>
    session.containerName || DockerManager.generateContainerName(parseInt(session.id, 10));

const hasAttachableContainer = async (session: WorktreeSession): Promise<boolean> => {
    if (!session.containerName && session.containers.length === 0) {
        return false;
    }

    try {
        return await DockerManager.containerExists({
            containerId: getContainerName(session),
        });
    } catch {
        return false;
    }
};

const displaySessionDetails = async (session: WorktreeSession) => {
    console.clear();
    console.log();
    console.log(chalk.bold.cyan('Workspace Details'));
    console.log(chalk.gray('═'.repeat(70)));
    console.log();
    console.log(chalk.bold('General'));
    console.log(chalk.gray('  ID:              '), session.id);
    console.log(chalk.gray('  Runtime Status:  '), getStatusBadge(session.status));
    console.log(
        chalk.gray('  Agent Status:    '),
        getAgentStatusBadge(session.agentStatus ?? 'unknown')
    );
    console.log(chalk.gray('  Combined:        '), getCompositeStatusBadge(session));
    console.log(chalk.gray('  Created:         '), formatDate(session.createdAt));
    console.log(chalk.gray('  Last Activity:   '), formatDate(session.lastActivity));
    if (session.agentStateTimestamp) {
        console.log(chalk.gray('  Agent Updated:   '), formatDate(session.agentStateTimestamp));
    }
    console.log();
    console.log(chalk.bold('Repository'));
    console.log(chalk.gray('  Path:            '), session.repoPath);
    console.log(chalk.gray('  Branch:          '), session.branchName);
    console.log(chalk.gray('  Worktree:        '), session.worktreePath);
    console.log();
    console.log(chalk.bold('Agent'));
    console.log(chalk.gray('  Type:            '), session.agent.type);
    if (session.claudeCodeVersion) {
        console.log(chalk.gray('  Version:         '), session.claudeCodeVersion);
    }
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

    const attachableContainer = await hasAttachableContainer(session);
    if (session.status !== SessionStatus.CLEANED && attachableContainer) {
        console.log(chalk.bold('Attach'));
        console.log(chalk.gray('  Command:         '), chalk.cyan(`viwo attach ${session.id}`));
        console.log();
    }

    if (!attachableContainer && session.status !== SessionStatus.CLEANED) {
        console.log(chalk.bold('Launch Agent'));
        console.log(chalk.gray('  Action:          '), chalk.cyan('Start agent from this workspace'));
        console.log();
    }

    if (session.error) {
        console.log(chalk.bold.red('Error'));
        console.log(chalk.gray('  '), session.error);
        console.log();
    }

    if (session.containerOutput) {
        console.log(chalk.bold('Container Output'));
        console.log(chalk.gray('─'.repeat(70)));
        // Display first 500 characters with option to see full output
        const output = session.containerOutput;
        const maxPreviewLength = 500;
        if (output.length > maxPreviewLength) {
            console.log(output.substring(0, maxPreviewLength));
            console.log(
                chalk.yellow(`\n... (${output.length - maxPreviewLength} more characters)`)
            );
            console.log(chalk.gray('  Full output stored in database'));
        } else {
            console.log(output);
        }
        console.log();
    }

    console.log(chalk.gray('═'.repeat(70)));
    console.log();
};

const handleSessionAction = async (session: WorktreeSession): Promise<'back' | 'exit'> => {
    const attachableContainer = await hasAttachableContainer(session);

    const actions = [
        {
            name: '▶️  Start agent',
            value: 'start-agent',
            disabled: session.status === SessionStatus.CLEANED || attachableContainer,
        },
        {
            name: '🔗 Attach to container',
            value: 'attach',
            disabled: session.status === SessionStatus.CLEANED || !attachableContainer,
        },
        {
            name: '💻 Open in IDE',
            value: 'open-ide',
            disabled: !session.worktreePath,
        },
        {
            name: '📄 View full container output',
            value: 'view-output',
            disabled: !session.containerOutput,
        },
        {
            name: '🗑️  Delete workspace',
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
        case 'start-agent': {
            try {
                await launchAgentForSession({
                    sessionId: session.id,
                    worktreePath: session.worktreePath,
                    repoPath: session.repoPath,
                    agent: session.agent.type,
                });
                console.log(chalk.green('✓ Agent started successfully'));
            } catch (error) {
                console.error(
                    chalk.red('Failed to start agent:'),
                    error instanceof Error ? error.message : String(error)
                );
            }
            console.log();
            console.log(chalk.gray('Press Enter to continue...'));
            await new Promise((resolve) => {
                process.stdin.once('data', resolve);
            });
            return 'back';
        }

        case 'attach': {
            const containerName = getContainerName(session);

            const exists = await DockerManager.containerExists({
                containerId: containerName,
            });

            if (!exists) {
                console.log(chalk.red(`Container ${containerName} no longer exists.`));
                console.log(chalk.gray('Run "viwo clean" to remove this workspace.'));
                console.log();
                console.log(chalk.gray('Press Enter to continue...'));
                await new Promise((resolve) => {
                    process.stdin.once('data', resolve);
                });
                return 'back';
            }

            const containerInfo = await DockerManager.inspectContainer({
                containerId: containerName,
            });

            if (!containerInfo.running) {
                console.log(chalk.dim(`Container ${containerName} is stopped. Restarting...`));
                await DockerManager.startContainer({ containerId: containerName });
                await new Promise((r) => setTimeout(r, 1000));
                console.log(chalk.green('Container restarted.'));
            }

            console.log();
            console.log(chalk.dim(`Attaching to workspace ${session.id} (${containerName})...`));
            console.log(chalk.yellow('Detach with: Ctrl+B, D'));
            console.log();
            execSync(`docker exec -it ${containerName} tmux attach -t viwo`, {
                stdio: 'inherit',
            });
            return 'back';
        }

        case 'open-ide':
            await selectAndOpenIDE(session.worktreePath);
            console.log(chalk.gray('Press Enter to continue...'));
            await new Promise((resolve) => {
                process.stdin.once('data', resolve);
            });
            return 'back';

        case 'view-output': {
            console.clear();
            console.log();
            console.log(chalk.bold.cyan('Container Output'));
            console.log(chalk.gray('═'.repeat(70)));
            console.log();
            console.log(session.containerOutput);
            console.log();
            console.log(chalk.gray('═'.repeat(70)));
            console.log();
            console.log(chalk.gray('Press Enter to go back...'));

            // Set stdin to resume and wait for actual user input
            process.stdin.resume();
            process.stdin.setRawMode(false);
            await new Promise((resolve) => {
                const handler = () => {
                    process.stdin.pause();
                    resolve(undefined);
                };
                process.stdin.once('data', handler);
            });

            // Redisplay session details
            await displaySessionDetails(session);
            return await handleSessionAction(session);
        }

        case 'delete': {
            console.log();
            const confirmDelete = await select({
                message: chalk.red(
                    `Are you sure you want to delete workspace ${session.id.substring(0, 12)}?`
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
                    console.log(chalk.green('✓ Workspace deleted successfully'));
                    console.log();
                    console.log(chalk.gray('Press Enter to continue...'));
                    await new Promise((resolve) => {
                        process.stdin.once('data', resolve);
                    });
                } catch (error) {
                    console.error(
                        chalk.red('Failed to delete workspace:'),
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
                await preflightChecksOrExit({ requireGit: false });
                await viwo.sync();
            }

            const sessions = await viwo.list({
                status: options.status,
                limit: options.limit,
            });

            if (sessions.length === 0) {
                console.clear();
                console.log();
                console.log(chalk.yellow('No workspaces found.'));
                console.log(
                    chalk.gray('Create a new workspace with: ') + chalk.cyan('viwo create')
                );
                console.log();
                break;
            }

            console.clear();
            console.log();
            console.log(chalk.bold.cyan('VIWO Workspaces'));
            console.log(chalk.gray('Use arrow keys to navigate, Enter to select'));
            console.log(chalk.gray('Left status = container/runtime, right status = coding agent'));
            console.log();

            const sessionChoices = sessions.map((session) => ({
                name: `${getCompositeStatusBadge(session)} ${session.branchName.padEnd(40)} ${chalk.gray(formatDate(session.createdAt))}`,
                value: session.id,
                description: `${session.agent.type} | ${session.id.substring(0, 12)}`,
            }));

            const selectedId = await select({
                message: `Select a workspace (${sessions.length} total):`,
                choices: [
                    ...sessionChoices,
                    new Separator(chalk.gray('─'.repeat(70))),
                    {
                        name: chalk.gray('❌ Exit'),
                        value: '__exit__',
                        description: 'Exit interactive mode',
                    },
                ],
                pageSize: 15,
            });

            if (selectedId === '__exit__') {
                break;
            }

            // Fetch the full workspace details
            const session = await viwo.get(selectedId);

            if (!session) {
                console.log(chalk.red('Workspace not found'));
                continue;
            }

            // Display workspace details
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
