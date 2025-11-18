import Docker from 'dockerode';
import fs from 'fs';
import { ContainerInfo, PortMapping } from './schemas';

export class DockerManager {
    private docker: Docker;

    constructor() {
        this.docker = new Docker();
    }

    async isDockerRunning(): Promise<boolean> {
        try {
            await this.docker.ping();
            return true;
        } catch (error) {
            return false;
        }
    }

    async createContainersFromCompose(
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
        if (!fs.existsSync(composePath)) {
            throw new Error(`Docker compose file not found: ${composePath}`);
        }

        // TODO: Parse docker-compose.yml and create containers
        // For MVP, we'll create a simple Node.js container as an example

        return containers;
    }

    async createContainer(
        name: string,
        image: string,
        worktreePath: string,
        ports: PortMapping[],
        env?: Record<string, string>
    ): Promise<ContainerInfo> {
        // Pull image if not exists
        await this.pullImage(image);

        // Create port bindings
        const portBindings: any = {};
        const exposedPorts: any = {};

        for (const port of ports) {
            const containerPort = `${port.container}/${port.protocol}`;
            exposedPorts[containerPort] = {};
            portBindings[containerPort] = [{ HostPort: port.host.toString() }];
        }

        // Create container
        const container = await this.docker.createContainer({
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
            status: this.mapContainerStatus(info.State.Status),
            ports,
            createdAt: new Date(info.Created),
        };
    }

    async startContainer(containerId: string): Promise<void> {
        const container = this.docker.getContainer(containerId);
        await container.start();
    }

    async stopContainer(containerId: string): Promise<void> {
        const container = this.docker.getContainer(containerId);
        await container.stop();
    }

    async removeContainer(containerId: string): Promise<void> {
        const container = this.docker.getContainer(containerId);
        await container.remove({ force: true });
    }

    async getContainerStatus(containerId: string): Promise<ContainerInfo['status']> {
        const container = this.docker.getContainer(containerId);
        const info = await container.inspect();
        return this.mapContainerStatus(info.State.Status);
    }

    private async pullImage(image: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.docker.pull(image, (err: any, stream: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.docker.modem.followProgress(
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

    private mapContainerStatus(dockerStatus: string): ContainerInfo['status'] {
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
}
