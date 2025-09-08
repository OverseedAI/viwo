import { execSync } from 'child_process';

export interface ContainerInfo {
    id: string;
    name: string;
    status: string;
    worktreeId: string;
    serviceType: string;
}

export interface ContainerConfig {
    image: string;
    workingDir?: string;
    ports?: string[];
    volumes?: string[];
    environment?: Record<string, string>;
    command?: string[];
}

function generateRandomSuffix(): string {
    return Math.random().toString(36).substring(2, 8);
}

export function generateContainerName(worktreeId: string, serviceType: string): string {
    const sanitizedId = worktreeId.replace(/[^a-zA-Z0-9-]/g, '-');
    const sanitizedService = serviceType.replace(/[^a-zA-Z0-9-]/g, '-');
    const suffix = generateRandomSuffix();
    return `viwo-${sanitizedId}-${sanitizedService}-${suffix}`;
}

export function parseContainerName(
    name: string
): { worktreeId: string; serviceType: string } | null {
    const match = name.match(/^viwo-(.+)-(.+)-[a-z0-9]{6}$/);
    if (!match) return null;

    const [, worktreeId, serviceType] = match;
    return { worktreeId, serviceType };
}

export function listWorktreeContainers(worktreeId?: string): ContainerInfo[] {
    try {
        const filterPattern = worktreeId ? `viwo-${worktreeId}-` : 'viwo-';
        const output = execSync(
            `docker ps -a --filter "name=${filterPattern}" --format "{{.ID}}|{{.Names}}|{{.Status}}"`,
            { encoding: 'utf-8', stdio: 'pipe' }
        );

        const containers: ContainerInfo[] = [];
        const lines = output.split('\n').filter(line => line.trim());

        for (const line of lines) {
            const [id, name, status] = line.split('|');
            const parsed = parseContainerName(name);

            if (parsed) {
                containers.push({
                    id,
                    name,
                    status,
                    worktreeId: parsed.worktreeId,
                    serviceType: parsed.serviceType,
                });
            }
        }

        return containers;
    } catch (error) {
        return [];
    }
}

export function createContainer(
    worktreeId: string,
    serviceType: string,
    config: ContainerConfig
): string {
    const containerName = generateContainerName(worktreeId, serviceType);

    let dockerCommand = `docker run -d --name "${containerName}"`;

    if (config.workingDir) {
        dockerCommand += ` -w "${config.workingDir}"`;
    }

    if (config.ports) {
        for (const port of config.ports) {
            dockerCommand += ` -p ${port}`;
        }
    }

    if (config.volumes) {
        for (const volume of config.volumes) {
            dockerCommand += ` -v "${volume}"`;
        }
    }

    if (config.environment) {
        for (const [key, value] of Object.entries(config.environment)) {
            dockerCommand += ` -e ${key}="${value}"`;
        }
    }

    dockerCommand += ` ${config.image}`;

    if (config.command) {
        dockerCommand += ` ${config.command.join(' ')}`;
    }

    try {
        const containerId = execSync(dockerCommand, {
            encoding: 'utf-8',
            stdio: 'pipe',
        }).trim();

        return containerId;
    } catch (error) {
        throw new Error(
            `Failed to create container: ${error instanceof Error ? error.message : error}`
        );
    }
}

export function stopWorktreeContainers(worktreeId: string): void {
    const containers = listWorktreeContainers(worktreeId);

    for (const container of containers) {
        if (container.status.includes('Up')) {
            try {
                execSync(`docker stop ${container.id}`, { stdio: 'pipe' });
            } catch (error) {
                // Continue stopping other containers even if one fails
            }
        }
    }
}

export function removeWorktreeContainers(worktreeId: string): void {
    const containers = listWorktreeContainers(worktreeId);

    for (const container of containers) {
        try {
            if (container.status.includes('Up')) {
                execSync(`docker stop ${container.id}`, { stdio: 'pipe' });
            }
            execSync(`docker rm ${container.id}`, { stdio: 'pipe' });
        } catch (error) {
            // Continue removing other containers even if one fails
        }
    }
}

export function getContainersForWorktree(worktreeId: string): ContainerInfo[] {
    return listWorktreeContainers(worktreeId);
}
