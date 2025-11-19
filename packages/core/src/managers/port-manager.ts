import getPort from 'get-port';

function generatePortRange(portRange: { start: number; end: number }): number[] {
    const range: number[] = [];
    for (let i = portRange.start; i <= portRange.end; i++) {
        range.push(i);
    }
    return range;
}

export async function allocatePort(
    portRange: { start: number; end: number }
): Promise<number> {
    const port = await getPort({
        port: generatePortRange(portRange),
    });

    return port;
}

export async function allocatePorts(
    portRange: { start: number; end: number },
    count: number
): Promise<number[]> {
    const ports: number[] = [];

    for (let i = 0; i < count; i++) {
        const port = await allocatePort(portRange);
        ports.push(port);
    }

    return ports;
}
