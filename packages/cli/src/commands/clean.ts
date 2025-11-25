import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { viwo } from '@viwo/core';
import { checkPrerequisitesOrExit } from '../utils/prerequisites';

export const cleanCommand = new Command('clean')
    .description(
        'Clean up all completed or errored sessions (removes worktrees and updates status)'
    )
    .option('--keep-worktree', 'Keep the worktree directories')
    .option('--keep-containers', 'Keep containers running')
    .option('--no-sync', 'Skip syncing Docker state before cleanup')
    .option(
        '--status <status>',
        'Only clean sessions with specific status (completed, error, stopped)',
        'completed,error,stopped'
    )
    .action(async (options) => {
        try {
            // Check prerequisites before proceeding
            await checkPrerequisitesOrExit();

            const spinner = ora('Finding sessions to clean...').start();

            // Sync Docker state with database before cleanup
            if (options.sync !== false) {
                await viwo.sync();
            }

            // Parse status filter
            const statusFilter = options.status.split(',').map((s: string) => s.trim());

            // Get all sessions that match the status filter
            const allSessions = await viwo.list();
            const sessionsToClean = allSessions.filter((session) =>
                statusFilter.includes(session.status)
            );

            if (sessionsToClean.length === 0) {
                spinner.info(`No sessions found with status: ${statusFilter.join(', ')}`);
                return;
            }

            spinner.text = `Found ${sessionsToClean.length} session(s) to clean...`;

            let successCount = 0;
            let errorCount = 0;

            for (const session of sessionsToClean) {
                spinner.text = `Cleaning session ${session.id} (${session.branchName})...`;

                try {
                    await viwo.cleanup({
                        sessionId: session.id,
                        removeWorktree: !options.keepWorktree,
                        stopContainers: !options.keepContainers,
                        removeContainers: !options.keepContainers,
                    });
                    successCount++;
                } catch (error) {
                    errorCount++;
                    console.error(
                        chalk.yellow(
                            `\nWarning: Failed to clean session ${session.id}: ${error instanceof Error ? error.message : String(error)}`
                        )
                    );
                }
            }

            if (errorCount === 0) {
                spinner.succeed(`Successfully cleaned ${successCount} session(s)!`);
            } else {
                spinner.warn(`Cleaned ${successCount} session(s), ${errorCount} failed`);
            }
        } catch (error) {
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
            process.exit(1);
        }
    });
