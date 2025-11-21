import Docker from 'dockerode';
import { exists } from 'node:fs/promises';
import path from 'path';
import { ContainerInfo, PortMapping } from '../schemas';

const dockerSdk = new Docker();

// Default Claude Code image name
export const CLAUDE_CODE_IMAGE = 'viwo-claude-code:latest';

export const isDockerRunning = async (): Promise<boolean> => {
    try {
        await dockerSdk.ping();
        return true;
    } catch {
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
        WorkingDir: '/app',
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

interface PullImageOptions {
    image: string;
}

const pullImage = async (options: PullImageOptions): Promise<void> => {
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
    waitForContainer,
    CLAUDE_CODE_IMAGE,
};
