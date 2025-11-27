import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

export interface AttachToContainerOptions {
    containerId: string;
    onData?: (data: string) => void;
    onError?: (error: string) => void;
    onExit?: (code: number | null) => void;
}

export interface AttachHandle {
    process: ChildProcess;
    detach: () => void;
}

/**
 * Attach to a running Docker container and stream its output to the terminal.
 * Uses `docker logs -f` command via subprocess to stream all container output.
 * This is more reliable than `docker attach` especially with TTY containers.
 *
 * @param options Configuration for attaching to the container
 * @returns AttachHandle with process and detach method
 */
export const attachToContainer = (options: AttachToContainerOptions): AttachHandle => {
    const { containerId, onData, onError, onExit } = options;

    // Spawn docker logs process to follow container output
    // -f: Follow log output (stream new logs as they arrive)
    // --tail all: Show all existing logs from the beginning
    const dockerProcess = spawn('docker', ['logs', '-f', '--tail', 'all', containerId], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Handle stdout
    if (dockerProcess.stdout) {
        dockerProcess.stdout.on('data', (data: Buffer) => {
            const text = data.toString();
            if (onData) {
                onData(text);
            } else {
                // Default: write to stdout
                process.stdout.write(text);
            }
        });
    }

    // Handle stderr
    if (dockerProcess.stderr) {
        dockerProcess.stderr.on('data', (data: Buffer) => {
            const text = data.toString();
            if (onError) {
                onError(text);
            } else {
                // Default: write to stderr
                process.stderr.write(text);
            }
        });
    }

    // Handle process exit
    dockerProcess.on('exit', (code) => {
        if (onExit) {
            onExit(code);
        }
    });

    // Handle process errors
    dockerProcess.on('error', (err) => {
        if (onError) {
            onError(`Failed to spawn docker logs: ${err.message}`);
        } else {
            console.error(`Failed to spawn docker logs: ${err.message}`);
        }
    });

    // Return handle with detach method
    return {
        process: dockerProcess,
        detach: () => {
            // Kill the logs process without affecting the container
            // The container will continue running in the background
            dockerProcess.kill('SIGTERM');
        },
    };
};

/**
 * Attach to a container and wait for user to press CTRL+C to detach.
 * The container will continue running after detaching.
 *
 * @param options Configuration for attaching to the container
 * @returns Promise that resolves when user detaches (CTRL+C)
 */
export const attachAndWaitForDetach = (
    options: Omit<AttachToContainerOptions, 'onExit'>
): Promise<void> => {
    return new Promise((resolve) => {
        const handle = attachToContainer({
            ...options,
            onExit: () => {
                // Attachment ended (container stopped or we detached)
                resolve();
            },
        });

        // Listen for CTRL+C to detach
        const handleSigint = () => {
            // Remove the listener to avoid multiple calls
            process.off('SIGINT', handleSigint);

            // Detach from container
            handle.detach();

            // Resolve the promise
            resolve();
        };

        process.on('SIGINT', handleSigint);
    });
};

export const attach = {
    attachToContainer,
    attachAndWaitForDetach,
};
