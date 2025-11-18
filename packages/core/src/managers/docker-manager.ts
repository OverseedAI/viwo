import Docker from 'dockerode';
import { exists } from 'node:fs/promises';
import { ContainerInfo, PortMapping } from '../schemas';

const docker = new Docker();

export async function isDockerRunning(): Promise<boolean> {
    try {
        await docker.ping();
        return true;
    } catch (error) {
        return false;
    }
}

export async function createContainersFromCompose(
    composePath: string,
    worktreePath: string,
    portMappings: PortMapping[]
): Promise<ContainerInfo[]> {
    // For now, we'll implement a basic container creation
    // Full docker-compose support would require parsing the YAML
    // and creating containers accordingly

    // This is a simplified implementation
    const containers: ContainerInfo[] = [];

    // Check if docker-compose file exists
    if (!(await exists(composePath))) {
        throw new Error(`Docker compose file not found: ${composePath}`);
    }

    // TODO: Parse docker-compose.yml and create containers
    // For MVP, we'll create a simple Node.js container as an example

    return containers;
}

export async function createContainer(
    name: string,
    image: string,
    worktreePath: string,
    ports: PortMapping[],
    env?: Record<string, string>
): Promise<ContainerInfo> {
    // Pull image if not exists
    await pullImage(image);

    // Create port bindings
    const portBindings: any = {};
    const exposedPorts: any = {};

    for (const port of ports) {
        const containerPort = `${port.container}/${port.protocol}`;
        exposedPorts[containerPort] = {};
        portBindings[containerPort] = [{ HostPort: port.host.toString() }];
    }

    // Create container
    const container = await docker.createContainer({
        name,
        Image: image,
        ExposedPorts: exposedPorts,
        HostConfig: {
            PortBindings: portBindings,
            Binds: [`${worktreePath}:/app`],
            AutoRemove: false,
        },
        Env: env ? Object.entries(env).map(([k, v]) => `${k}=${v}`) : undefined,
        WorkingDir: '/app',
    });

    const info = await container.inspect();

    return {
        id: info.Id,
        name: info.Name.replace(/^\//, ''),
        image,
        status: mapContainerStatus(info.State.Status),
        ports,
        createdAt: new Date(info.Created),
    };
}

export async function startContainer(containerId: string): Promise<void> {
    const container = docker.getContainer(containerId);
    await container.start();
}

export async function stopContainer(containerId: string): Promise<void> {
    const container = docker.getContainer(containerId);
    await container.stop();
}

export async function removeContainer(containerId: string): Promise<void> {
    const container = docker.getContainer(containerId);
    await container.remove({ force: true });
}

export async function getContainerStatus(containerId: string): Promise<ContainerInfo['status']> {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    return mapContainerStatus(info.State.Status);
}

async function pullImage(image: string): Promise<void> {
    return new Promise((resolve, reject) => {
        docker.pull(image, (err: any, stream: any) => {
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
}

function mapContainerStatus(dockerStatus: string): ContainerInfo['status'] {
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
}
