import getPort from 'get-port';
import { StateManager } from './state-manager';

function generatePortRange(portRange: { start: number; end: number }): number[] {
    const range: number[] = [];
    for (let i = portRange.start; i <= portRange.end; i++) {
        range.push(i);
    }
    return range;
}

export async function allocatePort(
    stateManager: StateManager,
    portRange: { start: number; end: number }
): Promise<number> {
    // Get all currently allocated ports
    const sessions = stateManager.listSessions();
    const usedPorts = new Set<number>();

    for (const session of sessions) {
        for (const port of session.ports) {
            usedPorts.add(port.host);
        }
    }

    // Find an available port in our range
    const port = await getPort({
        port: generatePortRange(portRange),
        exclude: Array.from(usedPorts),
    });

    return port;
}

export async function allocatePorts(
    stateManager: StateManager,
    portRange: { start: number; end: number },
    count: number
): Promise<number[]> {
    const ports: number[] = [];

    for (let i = 0; i < count; i++) {
        const port = await allocatePort(stateManager, portRange);
        ports.push(port);
    }

    return ports;
}
