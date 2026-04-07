import { Command } from 'commander';
import chalk from 'chalk';
import { select, confirm, Separator } from '@inquirer/prompts';
import { existsSync } from 'node:fs';
import { viwo, SessionStatus, DockerManager } from '@viwo/core';
import { getCompositeStatusBadge, formatDate } from '../utils/formatters';
import { preflightChecksOrExit } from '../utils/prerequisites';
import { execSync } from 'child_process';

export const attachCommand = new Command('attach')
    .description('Attach to a running Claude Code session via tmux')
    .argument('[session-id]', 'Session ID to attach to')
    .action(async (sessionId?: string) => {
        try {
            await preflightChecksOrExit({ requireGit: false });
            await viwo.sync();

            let targetSessionId: string;

            if (sessionId) {
                targetSessionId = sessionId;
            } else {
                // Show interactive list of running sessions
                const sessions = await viwo.list({ status: SessionStatus.RUNNING });

                if (sessions.length === 0) {
                    console.log();
                    console.log(chalk.yellow('No running sessions found.'));
                    console.log(
                        chalk.gray('Create a new session with: ') + chalk.cyan('viwo start')
                    );
                    console.log();
                    process.exit(0);
                }

                const selectedId = await select({
                    message: 'Select a session to attach to:',
                    choices: [
                        ...sessions.map((s) => ({
                            name: `${getCompositeStatusBadge(s)} ${s.branchName.padEnd(40)} ${chalk.gray(formatDate(s.createdAt))}`,
                            value: s.id,
                            description: `${s.agent.type} | ${s.id.substring(0, 12)}`,
                        })),
                        new Separator(chalk.gray('─'.repeat(70))),
                        {
                            name: chalk.gray('❌ Cancel'),
                            value: '__cancel__',
                            description: 'Cancel attach',
                        },
                    ],
                    pageSize: 15,
                });

                if (selectedId === '__cancel__') {
                    process.exit(0);
                }

                targetSessionId = selectedId;
            }

            // Get the session
            const session = await viwo.get(targetSessionId);

            if (!session) {
                console.error(chalk.red(`Session not found: ${targetSessionId}`));
                process.exit(1);
            }

            // Determine container name
            const containerName =
                session.containerName ||
                DockerManager.generateContainerName(parseInt(targetSessionId, 10));

            // Check if container exists and is running
            let exists = await DockerManager.containerExists({
                containerId: containerName,
            });

            if (!exists) {
                // Check if worktree still exists on disk
                const worktreeExists = existsSync(session.worktreePath);

                if (!worktreeExists) {
                    console.error(chalk.red(`Container ${containerName} does not exist.`));
                    console.log(
                        chalk.gray(
                            'The worktree has also been removed. This session cannot be recreated.'
                        )
                    );
                    process.exit(1);
                }

                // Offer to recreate the container
                console.log();
                console.log(
                    chalk.yellow(
                        `Container ${containerName} no longer exists, but the session and worktree are intact.`
                    )
                );

                const shouldRecreate = await confirm({
                    message:
                        'Recreate the container? (starts tmux + bash; run "claude --continue" inside to resume)',
                    default: true,
                });

                if (!shouldRecreate) {
                    process.exit(0);
                }

                console.log(chalk.dim('Recreating container...'));

                await viwo.recreateContainer({
                    sessionId: parseInt(targetSessionId, 10),
                    worktreePath: session.worktreePath,
                });

                console.log(chalk.green(`Container ${containerName} recreated.`));
                exists = true;
            }

            const containerInfo = await DockerManager.inspectContainer({
                containerId: containerName,
            });

            if (!containerInfo.running) {
                console.error(chalk.red(`Container ${containerName} is not running.`));
                console.log(chalk.gray(`Container status: ${containerInfo.status}`));
                process.exit(1);
            }

            // Print attach hint and run docker exec
            console.log();
            console.log(chalk.dim(`Attaching to session ${targetSessionId} (${containerName})...`));
            console.log(chalk.yellow('Detach with: Ctrl+B, D'));
            console.log();

            execSync(`docker exec -it ${containerName} tmux attach -t viwo`, {
                stdio: 'inherit',
            });
        } catch (error) {
            if (error instanceof Error && error.name === 'ExitPromptError') {
                console.log();
                process.exit(0);
            }
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
            process.exit(1);
        }
    });
