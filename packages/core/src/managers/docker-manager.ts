import Docker from 'dockerode';
import { exists } from 'node:fs/promises';
import { ContainerInfo, PortMapping } from '../schemas';

const docker = new Docker();

export const isDockerRunning = async (): Promise<boolean> => {
    try {
        await docker.ping();
        return true;
    } catch (error) {
        return false;
    }
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
    ports: PortMapping[];
    env?: Record<string, string>;
}

export const createContainer = async (options: CreateContainerOptions): Promise<ContainerInfo> => {
    // Pull image if not exists
    await pullImage({ image: options.image });

    // Create port bindings
    const portBindings: any = {};
    const exposedPorts: any = {};

    for (const port of options.ports) {
        const containerPort = `${port.container}/${port.protocol}`;
        exposedPorts[containerPort] = {};
        portBindings[containerPort] = [{ HostPort: port.host.toString() }];
    }

    // Create container
    const container = await docker.createContainer({
        name: options.name,
        Image: options.image,
        ExposedPorts: exposedPorts,
        HostConfig: {
            PortBindings: portBindings,
            Binds: [`${options.worktreePath}:/app`],
            AutoRemove: false,
        },
        Env: options.env ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`) : undefined,
        WorkingDir: '/app',
    });

    const info = await container.inspect();

    return {
        id: info.Id,
        name: info.Name.replace(/^\//, ''),
        image: options.image,
        status: mapContainerStatus(info.State.Status),
        ports: options.ports,
        createdAt: new Date(info.Created),
    };
};

export interface ContainerIdOptions {
    containerId: string;
}

export const startContainer = async (options: ContainerIdOptions): Promise<void> => {
    const container = docker.getContainer(options.containerId);
    await container.start();
};

export const stopContainer = async (options: ContainerIdOptions): Promise<void> => {
    const container = docker.getContainer(options.containerId);
    await container.stop();
};

export const removeContainer = async (options: ContainerIdOptions): Promise<void> => {
    const container = docker.getContainer(options.containerId);
    await container.remove({ force: true });
};

export const getContainerStatus = async (options: ContainerIdOptions): Promise<ContainerInfo['status']> => {
    const container = docker.getContainer(options.containerId);
    const info = await container.inspect();
    return mapContainerStatus(info.State.Status);
};

interface PullImageOptions {
    image: string;
}

const pullImage = async (options: PullImageOptions): Promise<void> => {
    return new Promise((resolve, reject) => {
        docker.pull(options.image, (err: any, stream: any) => {
            if (err) {
                reject(err);
                return;
            }

            docker.modem.followProgress(
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
