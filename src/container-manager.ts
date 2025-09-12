import { $ } from 'bun';

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

export async function listWorktreeContainers(worktreeId?: string): Promise<ContainerInfo[]> {
    try {
        const filterPattern = worktreeId ? `viwo-${worktreeId}-` : 'viwo-';
        const output =
            await $`docker ps -a --filter name=${filterPattern} --format {{.ID}}|{{.Names}}|{{.Status}}`.text();

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

export async function createContainer(
    worktreeId: string,
    serviceType: string,
    config: ContainerConfig
): Promise<string> {
    const containerName = generateContainerName(worktreeId, serviceType);

    const args = ['docker', 'run', '-d', '--name', containerName];

    if (config.workingDir) {
        args.push('-w', config.workingDir);
    }

    if (config.ports) {
        for (const port of config.ports) {
            args.push('-p', port);
        }
    }

    if (config.volumes) {
        for (const volume of config.volumes) {
            args.push('-v', volume);
        }
    }

    if (config.environment) {
        for (const [key, value] of Object.entries(config.environment)) {
            args.push('-e', `${key}=${value}`);
        }
    }

    args.push(config.image);

    if (config.command) {
        args.push(...config.command);
    }

    try {
        const result = await $`${args}`.text();
        return result.trim();
    } catch (error) {
        throw new Error(
            `Failed to create container: ${error instanceof Error ? error.message : error}`
        );
    }
}

export async function stopWorktreeContainers(worktreeId: string): Promise<void> {
    const containers = await listWorktreeContainers(worktreeId);

    for (const container of containers) {
        if (container.status.includes('Up')) {
            try {
                await $`docker stop ${container.id}`;
            } catch (error) {
                // Continue stopping other containers even if one fails
            }
        }
    }
}

export async function removeWorktreeContainers(worktreeId: string): Promise<void> {
    const containers = await listWorktreeContainers(worktreeId);

    for (const container of containers) {
        try {
            if (container.status.includes('Up')) {
                await $`docker stop ${container.id}`;
            }
            await $`docker rm ${container.id}`;
        } catch (error) {
            // Continue removing other containers even if one fails
        }
    }
}

export async function getContainersForWorktree(worktreeId: string): Promise<ContainerInfo[]> {
    return await listWorktreeContainers(worktreeId);
}
