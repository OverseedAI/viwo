import Docker from 'dockerode';
import { exists } from 'node:fs/promises';
import path from 'path';
import { ContainerInfo, PortMapping, SessionStatus } from '../schemas';
import { listSessions, updateSession } from './session-manager';
import { db } from '../db';
import { chats, NewChat } from '../db-schemas';

/**
 * Get platform-specific Docker configuration
 *
 * On Windows, Docker Desktop exposes the Docker daemon via a named pipe at
 * \\.\pipe\docker_engine. This works for both WSL2 and Hyper-V backends.
 *
 * On Unix-based systems (macOS, Linux), Docker uses a Unix socket at
 * /var/run/docker.sock.
 *
 * @returns Docker configuration with the appropriate socket path
 */
const getDockerConfig = (): Docker.DockerOptions => {
    const platform = process.platform;

    if (platform === 'win32') {
        // Windows: Use named pipe for Docker Desktop
        // This works for both WSL2 and Hyper-V backends
        return {
            socketPath: '\\\\.\\pipe\\docker_engine',
        };
    }

    // macOS and Linux: Use Unix socket
    return {
        socketPath: '/var/run/docker.sock',
    };
};

const dockerSdk = new Docker(getDockerConfig());

// Default Claude Code image name
export const CLAUDE_CODE_IMAGE = 'overseedai/viwo-claude-code:1.0.0';

export const isDockerRunning = async (): Promise<boolean> => {
    try {
        await dockerSdk.ping();
        return true;
    } catch (err) {
        // Enhanced error logging for Windows users
        // if (process.platform === 'win32') {
        //     console.error('Docker ping failed on Windows:', err);
        //     console.error('Ensure Docker Desktop is running and using the default named pipe.');
        // } else {
        //     console.error('Docker ping failed:', err);
        // }
        return false;
    }
};

const checkDockerRunningOrThrow = async (): Promise<void> => {
    const dockerRunning = await isDockerRunning();

    if (!dockerRunning) {
        throw new Error('Docker is not running. Please start Docker and try again.');
    }
};

export interface CheckImageExistsOptions {
    image: string;
}

export const checkImageExists = async (options: CheckImageExistsOptions): Promise<boolean> => {
    try {
        const image = dockerSdk.getImage(options.image);
        await image.inspect();
        return true;
    } catch {
        return false;
    }
};

export interface BuildImageOptions {
    dockerfilePath: string;
    imageName: string;
    context?: string;
}

export const buildImage = async (options: BuildImageOptions): Promise<void> => {
    const contextPath = options.context || path.dirname(options.dockerfilePath);

    return new Promise((resolve, reject) => {
        dockerSdk.buildImage(
            {
                context: contextPath,
                src: [path.basename(options.dockerfilePath)],
            },
            { t: options.imageName },
            (err, stream) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!stream) {
                    reject(new Error('No build stream returned'));
                    return;
                }

                dockerSdk.modem.followProgress(
                    stream,
                    (err: Error | null) => {
                        if (err) reject(err);
                        else resolve();
                    },
                    () => {} // Progress callback
                );
            }
        );
    });
};

export interface CreateContainersFromComposeOptions {
    composePath: string;
    worktreePath: string;
    portMappings: PortMapping[];
}

export const createContainersFromCompose = async (
    options: CreateContainersFromComposeOptions
): Promise<ContainerInfo[]> => {
    // For now, we'll implement a basic container creation
    // Full docker-compose support would require parsing the YAML
    // and creating containers accordingly

    // This is a simplified implementation
    const containers: ContainerInfo[] = [];

    // Check if docker-compose file exists
    if (!(await exists(options.composePath))) {
        throw new Error(`Docker compose file not found: ${options.composePath}`);
    }

    // TODO: Parse docker-compose.yml and create containers
    // For MVP, we'll create a simple Node.js container as an example

    return containers;
};

export interface CreateContainerOptions {
    name: string;
    image: string;
    worktreePath: string;
    ports?: PortMapping[];
    env?: Record<string, string>;
    command?: string[];
    tty?: boolean;
    openStdin?: boolean;
}

export const createContainer = async (options: CreateContainerOptions): Promise<ContainerInfo> => {
    // Check if image exists locally, if not pull it
    const imageExists = await checkImageExists({ image: options.image });
    if (!imageExists) {
        await pullImage({ image: options.image });
    }

    // Create port bindings
    const portBindings: Record<string, { HostPort: string }[]> = {};
    const exposedPorts: Record<string, object> = {};

    const ports = options.ports || [];
    for (const port of ports) {
        const containerPort = `${port.container}/${port.protocol}`;
        exposedPorts[containerPort] = {};
        portBindings[containerPort] = [{ HostPort: port.host.toString() }];
    }

    // Create container
    const container = await dockerSdk.createContainer({
        name: options.name,
        Image: options.image,
        Cmd: options.command,
        ExposedPorts: Object.keys(exposedPorts).length > 0 ? exposedPorts : undefined,
        HostConfig: {
            PortBindings: Object.keys(portBindings).length > 0 ? portBindings : undefined,
            Binds: [`${options.worktreePath}:/workspace`],
            AutoRemove: false,
        },
        Env: options.env ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`) : undefined,
        WorkingDir: '/workspace',
        Tty: options.tty ?? false,
        OpenStdin: options.openStdin ?? false,
    });

    const info = await container.inspect();

    return {
        id: info.Id,
        name: info.Name.replace(/^\//, ''),
        image: options.image,
        status: mapContainerStatus(info.State.Status),
        ports,
        createdAt: new Date(info.Created),
    };
};

export interface GetContainerLogsOptions {
    containerId: string;
    follow?: boolean;
    stdout?: boolean;
    stderr?: boolean;
    since?: number;
    tail?: number;
}

export interface LogStreamCallback {
    (log: string): void;
}

export const getContainerLogs = async (
    options: GetContainerLogsOptions,
    callback: LogStreamCallback
): Promise<void> => {
    const container = dockerSdk.getContainer(options.containerId);

    const follow = options.follow ?? true;
    const stream = await container.logs({
        follow: follow as true,
        stdout: options.stdout ?? true,
        stderr: options.stderr ?? true,
        since: options.since ?? 0,
        tail: options.tail,
    });

    // Handle the stream
    if (typeof stream === 'string') {
        callback(stream);
        return;
    }

    // Stream is a NodeJS.ReadableStream
    stream.on('data', (chunk: Buffer) => {
        // Docker multiplexes stdout/stderr in the stream
        // Each frame has an 8-byte header
        // First byte: stream type (1=stdout, 2=stderr)
        // Bytes 4-7: frame size (big endian)
        let offset = 0;
        while (offset < chunk.length) {
            if (offset + 8 > chunk.length) break;

            const frameSize = chunk.readUInt32BE(offset + 4);
            const frameEnd = offset + 8 + frameSize;

            if (frameEnd > chunk.length) break;

            const content = chunk.slice(offset + 8, frameEnd).toString('utf8');
            if (content.trim()) {
                callback(content);
            }

            offset = frameEnd;
        }
    });

    stream.on('error', (err: Error) => {
        callback(`Error: ${err.message}`);
    });
};

/**
 * Get container logs since a specific timestamp (non-streaming)
 * Returns all logs as a single string
 *
 * Note: When follow=false, Docker returns raw log content as a Buffer without multiplexing.
 * The multiplexed format (with 8-byte headers) is only used with follow=true.
 */
export const getContainerLogsSince = async (
    options: Omit<GetContainerLogsOptions, 'follow'>
): Promise<string> => {
    const container = dockerSdk.getContainer(options.containerId);

    const result = await container.logs({
        follow: false,
        stdout: options.stdout ?? true,
        stderr: options.stderr ?? true,
        since: options.since ?? 0,
        tail: options.tail,
    });

    // When follow is false, logs() returns raw Buffer content (no multiplexing)
    if (Buffer.isBuffer(result)) {
        return result.toString('utf8');
    }

    // Fallback: if it's a string
    if (typeof result === 'string') {
        return result;
    }

    // Shouldn't reach here, but just in case
    return '';
};

export interface WaitForContainerOptions {
    containerId: string;
}

export interface ContainerWaitResult {
    statusCode: number;
}

export const waitForContainer = async (
    options: WaitForContainerOptions
): Promise<ContainerWaitResult> => {
    const container = dockerSdk.getContainer(options.containerId);
    const result = await container.wait();
    return { statusCode: result.StatusCode };
};

export interface ContainerIdOptions {
    containerId: string;
}

export const startContainer = async (options: ContainerIdOptions): Promise<void> => {
    const container = dockerSdk.getContainer(options.containerId);
    await container.start();
};

export const stopContainer = async (options: ContainerIdOptions): Promise<void> => {
    const container = dockerSdk.getContainer(options.containerId);
    await container.stop();
};

export const removeContainer = async (options: ContainerIdOptions): Promise<void> => {
    const container = dockerSdk.getContainer(options.containerId);
    await container.remove({ force: true });
};

export const getContainerStatus = async (
    options: ContainerIdOptions
): Promise<ContainerInfo['status']> => {
    const container = dockerSdk.getContainer(options.containerId);
    const info = await container.inspect();
    return mapContainerStatus(info.State.Status);
};

export interface PullImageOptions {
    image: string;
}

export const pullImage = async (options: PullImageOptions): Promise<void> => {
    return new Promise((resolve, reject) => {
        dockerSdk.pull(options.image, (err: any, stream: any) => {
            if (err) {
                reject(err);
                return;
            }

            dockerSdk.modem.followProgress(
                stream,
                (err: any) => {
                    if (err) reject(err);
                    else resolve();
                },
                () => {} // Progress callback
            );
        });
    });
};

const mapContainerStatus = (dockerStatus: string): ContainerInfo['status'] => {
    switch (dockerStatus.toLowerCase()) {
        case 'created':
            return 'created';
        case 'running':
            return 'running';
        case 'paused':
        case 'restarting':
            return 'running';
        case 'removing':
        case 'exited':
            return 'exited';
        case 'dead':
            return 'error';
        default:
            return 'stopped';
    }
};

export const containerExists = async (options: ContainerIdOptions): Promise<boolean> => {
    try {
        const container = dockerSdk.getContainer(options.containerId);
        await container.inspect();
        return true;
    } catch {
        return false;
    }
};

export interface ContainerInspectResult {
    status: ContainerInfo['status'];
    exitCode: number | null;
    running: boolean;
}

export const inspectContainer = async (
    options: ContainerIdOptions
): Promise<ContainerInspectResult> => {
    const container = dockerSdk.getContainer(options.containerId);
    const info = await container.inspect();
    return {
        status: mapContainerStatus(info.State.Status),
        exitCode: info.State.ExitCode ?? null,
        running: info.State.Running,
    };
};

export interface SyncResult {
    sessionId: number;
    previousStatus: string;
    newStatus: SessionStatus;
    reason: string;
}

export interface SyncDockerStateResult {
    synced: SyncResult[];
    errors: { sessionId: number; error: string }[];
}

export const syncDockerState = async (): Promise<SyncDockerStateResult> => {
    const result: SyncDockerStateResult = {
        synced: [],
        errors: [],
    };

    // Query all sessions with status 'running' or 'initializing'
    const activeSessions = listSessions().filter(
        (s) => s.status === SessionStatus.RUNNING || s.status === SessionStatus.INITIALIZING
    );

    for (const session of activeSessions) {
        if (!session.containerId) {
            continue;
        }

        try {
            const exists = await containerExists({ containerId: session.containerId });

            if (!exists) {
                // Container not found - mark session as error
                updateSession({
                    id: session.id,
                    updates: {
                        status: SessionStatus.ERROR,
                        error: 'Container not found',
                        lastActivity: new Date().toISOString(),
                    },
                });

                result.synced.push({
                    sessionId: session.id,
                    previousStatus: session.status || 'unknown',
                    newStatus: SessionStatus.ERROR,
                    reason: 'Container not found',
                });
                continue;
            }

            const containerInfo = await inspectContainer({ containerId: session.containerId });

            // Capture logs since last activity and store in chats table
            let hasNewLogs = false;
            try {
                if (session.lastActivity) {
                    // Convert lastActivity to Unix timestamp (seconds)
                    const lastActivityDate = new Date(session.lastActivity.replace(' ', 'T') + 'Z');
                    const sinceTimestamp = Math.floor(lastActivityDate.getTime() / 1000);

                    // Fetch logs since last activity
                    const logs = await getContainerLogsSince({
                        containerId: session.containerId,
                        since: sinceTimestamp,
                        stdout: true,
                        stderr: true,
                    });

                    // Store logs in chats table if there are any
                    if (logs && logs.trim()) {
                        const chatEntry: NewChat = {
                            sessionId: session.id.toString(),
                            type: 'assistant',
                            content: logs,
                            createdAt: new Date().toISOString(),
                        };
                        db.insert(chats).values(chatEntry).run();
                        hasNewLogs = true;
                    }
                }
            } catch (logError) {
                // Log errors shouldn't fail the sync, just log them
                console.warn(`Failed to capture logs for session ${session.id}:`, logError);
            }

            // Determine new session status based on container state
            let newStatus: SessionStatus | null = null;
            let reason = '';

            if (containerInfo.running) {
                // Container is running - session should be running
                if (session.status !== SessionStatus.RUNNING) {
                    newStatus = SessionStatus.RUNNING;
                    reason = 'Container is running';
                }
            } else {
                // Container is not running (exited, dead, etc.)
                if (containerInfo.status === 'exited') {
                    if (containerInfo.exitCode === 0) {
                        newStatus = SessionStatus.COMPLETED;
                        reason = `Container exited with code 0`;
                    } else {
                        newStatus = SessionStatus.ERROR;
                        reason = `Container exited with code ${containerInfo.exitCode}`;
                    }
                } else if (containerInfo.status === 'error') {
                    newStatus = SessionStatus.ERROR;
                    reason = 'Container is in error state';
                } else {
                    newStatus = SessionStatus.STOPPED;
                    reason = `Container status: ${containerInfo.status}`;
                }
            }

            // Update session if status changed or we have new logs
            if (newStatus && newStatus !== session.status) {
                const updates: { status: string; error?: string; lastActivity: string } = {
                    status: newStatus,
                    lastActivity: new Date().toISOString(),
                };

                if (newStatus === SessionStatus.ERROR) {
                    updates.error = reason;
                }

                updateSession({
                    id: session.id,
                    updates,
                });

                result.synced.push({
                    sessionId: session.id,
                    previousStatus: session.status || 'unknown',
                    newStatus,
                    reason,
                });
            } else if (hasNewLogs) {
                // Update lastActivity even if status didn't change, since we captured new logs
                updateSession({
                    id: session.id,
                    updates: {
                        lastActivity: new Date().toISOString(),
                    },
                });
            }
        } catch (error) {
            result.errors.push({
                sessionId: session.id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return result;
};

export const docker = {
    isDockerRunning,
    checkDockerRunningOrThrow,
    checkImageExists,
    buildImage,
    createContainersFromCompose,
    createContainer,
    startContainer,
    stopContainer,
    removeContainer,
    getContainerStatus,
    getContainerLogs,
    getContainerLogsSince,
    waitForContainer,
    containerExists,
    inspectContainer,
    syncDockerState,
    CLAUDE_CODE_IMAGE,
};
