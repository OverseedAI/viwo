import getPort from 'get-port';

const generatePortRange = (portRange: { start: number; end: number }): number[] => {
    const range: number[] = [];
    for (let i = portRange.start; i <= portRange.end; i++) {
        range.push(i);
    }
    return range;
};

export interface PortRangeOptions {
    portRange: { start: number; end: number };
}

export const allocatePort = async (options: PortRangeOptions): Promise<number> => {
    const port = await getPort({
        port: generatePortRange(options.portRange),
    });

    return port;
};

export interface AllocatePortsOptions {
    portRange: { start: number; end: number };
    count: number;
}

export const allocatePorts = async (options: AllocatePortsOptions): Promise<number[]> => {
    const ports: number[] = [];

    for (let i = 0; i < options.count; i++) {
        const port = await allocatePort({ portRange: options.portRange });
        ports.push(port);
    }

    return ports;
};
