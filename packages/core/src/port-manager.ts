import getPort from 'get-port';
import { StateManager } from './state-manager';

export class PortManager {
    constructor(
        private stateManager: StateManager,
        private portRange: { start: number; end: number }
    ) {}

    async allocatePort(): Promise<number> {
        // Get all currently allocated ports
        const sessions = this.stateManager.listSessions();
        const usedPorts = new Set<number>();

        for (const session of sessions) {
            for (const port of session.ports) {
                usedPorts.add(port.host);
            }
        }

        // Find an available port in our range
        const port = await getPort({
            port: this.generatePortRange(),
            exclude: Array.from(usedPorts),
        });

        return port;
    }

    async allocatePorts(count: number): Promise<number[]> {
        const ports: number[] = [];

        for (let i = 0; i < count; i++) {
            const port = await this.allocatePort();
            ports.push(port);
        }

        return ports;
    }

    private generatePortRange(): number[] {
        const range: number[] = [];
        for (let i = this.portRange.start; i <= this.portRange.end; i++) {
            range.push(i);
        }
        return range;
    }
}
