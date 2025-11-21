import { Command } from 'commander';
import chalk from 'chalk';
import { viwo } from '@viwo/core';

export const attachCommand = new Command('attach')
    .description('Attach to a running session container')
    .argument('<session-id>', 'Session ID to attach to')
    .action(async (sessionId: string) => {
        try {
            const id = parseInt(sessionId, 10);
            if (isNaN(id)) {
                console.error(chalk.red('Invalid session ID'));
                process.exit(1);
            }

            // Get session details
            const session = viwo.session.get({ id });
            if (!session) {
                console.error(chalk.red(`Session ${id} not found`));
                process.exit(1);
            }

            if (!session.containerId) {
                console.error(chalk.red(`Session ${id} has no container`));
                process.exit(1);
            }

            // Check container status
            const status = await viwo.docker.getContainerStatus({
                containerId: session.containerId,
            });

            if (status !== 'running') {
                console.error(chalk.red(`Container is not running (status: ${status})`));
                process.exit(1);
            }

            // Set up TTY for raw mode
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
            }

            // Resize handler
            const handleResize = () => {
                if (process.stdout.isTTY) {
                    viwo.docker
                        .attachContainer({
                            containerId: session.containerId!,
                            stdin: process.stdin,
                            stdout: process.stdout,
                            stderr: process.stderr,
                        })
                        .catch(() => {
                            // Ignore - we'll handle this in the main attach
                        });
                }
            };

            // Listen for resize events
            process.stdout.on('resize', handleResize);

            console.log(chalk.gray(`Attaching to session ${id}...`));
            console.log(chalk.gray('Press Ctrl+C to detach\n'));

            // Attach to the container
            const result = await viwo.docker.attachContainer({
                containerId: session.containerId,
                stdin: process.stdin,
                stdout: process.stdout,
                stderr: process.stderr,
            });

            // Cleanup
            process.stdout.removeListener('resize', handleResize);
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(false);
            }

            console.log(chalk.gray(`\nContainer exited with code ${result.statusCode}`));
            process.exit(result.statusCode);
        } catch (error) {
            // Restore terminal on error
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(false);
            }
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
            process.exit(1);
        }
    });
