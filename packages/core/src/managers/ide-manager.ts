import { $ } from 'bun';
import { exists } from 'node:fs/promises';

export type IDEType =
    | 'vscode'
    | 'vscode-insiders'
    | 'cursor'
    | 'webstorm'
    | 'intellij-idea'
    | 'intellij-idea-ce'
    | 'pycharm'
    | 'pycharm-ce'
    | 'goland'
    | 'phpstorm'
    | 'rubymine'
    | 'clion'
    | 'datagrip'
    | 'rider';

export interface IDEInfo {
    type: IDEType;
    name: string;
    command: string;
    available: boolean;
}

interface IDEConfig {
    type: IDEType;
    name: string;
    command: string;
    paths?: {
        darwin?: string[];
        linux?: string[];
        win32?: string[];
    };
}

const IDE_CONFIGS: IDEConfig[] = [
    {
        type: 'vscode',
        name: 'Visual Studio Code',
        command: 'code',
        paths: {
            darwin: ['/Applications/Visual Studio Code.app'],
            linux: ['/usr/bin/code', '/usr/local/bin/code', '/snap/bin/code'],
            win32: [
                'C:\\Program Files\\Microsoft VS Code\\Code.exe',
                `${process.env.LOCALAPPDATA}\\Programs\\Microsoft VS Code\\Code.exe`,
            ],
        },
    },
    {
        type: 'vscode-insiders',
        name: 'Visual Studio Code Insiders',
        command: 'code-insiders',
        paths: {
            darwin: ['/Applications/Visual Studio Code - Insiders.app'],
            linux: [
                '/usr/bin/code-insiders',
                '/usr/local/bin/code-insiders',
                '/snap/bin/code-insiders',
            ],
            win32: [
                'C:\\Program Files\\Microsoft VS Code Insiders\\Code - Insiders.exe',
                `${process.env.LOCALAPPDATA}\\Programs\\Microsoft VS Code Insiders\\Code - Insiders.exe`,
            ],
        },
    },
    {
        type: 'cursor',
        name: 'Cursor',
        command: 'cursor',
        paths: {
            darwin: ['/Applications/Cursor.app'],
            linux: [
                '/usr/bin/cursor',
                '/usr/local/bin/cursor',
                `${process.env.HOME}/.local/bin/cursor`,
            ],
            win32: [`${process.env.LOCALAPPDATA}\\Programs\\Cursor\\Cursor.exe`],
        },
    },
    {
        type: 'webstorm',
        name: 'WebStorm',
        command: 'webstorm',
        paths: {
            darwin: ['/Applications/WebStorm.app'],
            linux: [
                '/opt/jetbrains/webstorm/bin/webstorm.sh',
                `${process.env.HOME}/.local/share/JetBrains/Toolbox/apps/WebStorm/bin/webstorm.sh`,
            ],
            win32: ['C:\\Program Files\\JetBrains\\WebStorm\\bin\\webstorm64.exe'],
        },
    },
    {
        type: 'intellij-idea',
        name: 'IntelliJ IDEA Ultimate',
        command: 'idea',
        paths: {
            darwin: ['/Applications/IntelliJ IDEA.app'],
            linux: [
                '/opt/jetbrains/idea/bin/idea.sh',
                `${process.env.HOME}/.local/share/JetBrains/Toolbox/apps/IDEA-U/bin/idea.sh`,
            ],
            win32: ['C:\\Program Files\\JetBrains\\IntelliJ IDEA\\bin\\idea64.exe'],
        },
    },
    {
        type: 'intellij-idea-ce',
        name: 'IntelliJ IDEA Community',
        command: 'idea-ce',
        paths: {
            darwin: ['/Applications/IntelliJ IDEA CE.app'],
            linux: [
                '/opt/jetbrains/idea-ce/bin/idea.sh',
                `${process.env.HOME}/.local/share/JetBrains/Toolbox/apps/IDEA-C/bin/idea.sh`,
            ],
            win32: [
                'C:\\Program Files\\JetBrains\\IntelliJ IDEA Community Edition\\bin\\idea64.exe',
            ],
        },
    },
    {
        type: 'pycharm',
        name: 'PyCharm Professional',
        command: 'pycharm',
        paths: {
            darwin: ['/Applications/PyCharm.app'],
            linux: [
                '/opt/jetbrains/pycharm/bin/pycharm.sh',
                `${process.env.HOME}/.local/share/JetBrains/Toolbox/apps/PyCharm-P/bin/pycharm.sh`,
            ],
            win32: ['C:\\Program Files\\JetBrains\\PyCharm\\bin\\pycharm64.exe'],
        },
    },
    {
        type: 'pycharm-ce',
        name: 'PyCharm Community',
        command: 'pycharm-ce',
        paths: {
            darwin: ['/Applications/PyCharm CE.app'],
            linux: [
                '/opt/jetbrains/pycharm-ce/bin/pycharm.sh',
                `${process.env.HOME}/.local/share/JetBrains/Toolbox/apps/PyCharm-C/bin/pycharm.sh`,
            ],
            win32: ['C:\\Program Files\\JetBrains\\PyCharm Community Edition\\bin\\pycharm64.exe'],
        },
    },
    {
        type: 'goland',
        name: 'GoLand',
        command: 'goland',
        paths: {
            darwin: ['/Applications/GoLand.app'],
            linux: [
                '/opt/jetbrains/goland/bin/goland.sh',
                `${process.env.HOME}/.local/share/JetBrains/Toolbox/apps/Goland/bin/goland.sh`,
            ],
            win32: ['C:\\Program Files\\JetBrains\\GoLand\\bin\\goland64.exe'],
        },
    },
    {
        type: 'phpstorm',
        name: 'PhpStorm',
        command: 'phpstorm',
        paths: {
            darwin: ['/Applications/PhpStorm.app'],
            linux: [
                '/opt/jetbrains/phpstorm/bin/phpstorm.sh',
                `${process.env.HOME}/.local/share/JetBrains/Toolbox/apps/PhpStorm/bin/phpstorm.sh`,
            ],
            win32: ['C:\\Program Files\\JetBrains\\PhpStorm\\bin\\phpstorm64.exe'],
        },
    },
    {
        type: 'rubymine',
        name: 'RubyMine',
        command: 'rubymine',
        paths: {
            darwin: ['/Applications/RubyMine.app'],
            linux: [
                '/opt/jetbrains/rubymine/bin/rubymine.sh',
                `${process.env.HOME}/.local/share/JetBrains/Toolbox/apps/RubyMine/bin/rubymine.sh`,
            ],
            win32: ['C:\\Program Files\\JetBrains\\RubyMine\\bin\\rubymine64.exe'],
        },
    },
    {
        type: 'clion',
        name: 'CLion',
        command: 'clion',
        paths: {
            darwin: ['/Applications/CLion.app'],
            linux: [
                '/opt/jetbrains/clion/bin/clion.sh',
                `${process.env.HOME}/.local/share/JetBrains/Toolbox/apps/CLion/bin/clion.sh`,
            ],
            win32: ['C:\\Program Files\\JetBrains\\CLion\\bin\\clion64.exe'],
        },
    },
    {
        type: 'datagrip',
        name: 'DataGrip',
        command: 'datagrip',
        paths: {
            darwin: ['/Applications/DataGrip.app'],
            linux: [
                '/opt/jetbrains/datagrip/bin/datagrip.sh',
                `${process.env.HOME}/.local/share/JetBrains/Toolbox/apps/datagrip/bin/datagrip.sh`,
            ],
            win32: ['C:\\Program Files\\JetBrains\\DataGrip\\bin\\datagrip64.exe'],
        },
    },
    {
        type: 'rider',
        name: 'Rider',
        command: 'rider',
        paths: {
            darwin: ['/Applications/Rider.app'],
            linux: [
                '/opt/jetbrains/rider/bin/rider.sh',
                `${process.env.HOME}/.local/share/JetBrains/Toolbox/apps/Rider/bin/rider.sh`,
            ],
            win32: ['C:\\Program Files\\JetBrains\\Rider\\bin\\rider64.exe'],
        },
    },
];

const checkCommandInPath = async (command: string): Promise<boolean> => {
    try {
        await $`command -v ${command}`.quiet();
        return true;
    } catch {
        return false;
    }
};

const checkPathExists = async (path: string): Promise<boolean> => {
    try {
        return await exists(path);
    } catch {
        return false;
    }
};

const isIDEAvailableByConfig = async (config: IDEConfig): Promise<boolean> => {
    const platform = process.platform as 'darwin' | 'linux' | 'win32';

    // Check if command is in PATH
    const inPath = await checkCommandInPath(config.command);
    if (inPath) {
        return true;
    }

    // Check standard installation paths
    const platformPaths = config.paths?.[platform];
    if (platformPaths) {
        for (const path of platformPaths) {
            const pathExists = await checkPathExists(path);
            if (pathExists) {
                return true;
            }
        }
    }

    return false;
};

export const detectAvailableIDEs = async (): Promise<IDEInfo[]> => {
    const results: IDEInfo[] = [];

    for (const config of IDE_CONFIGS) {
        const available = await isIDEAvailableByConfig(config);
        results.push({
            type: config.type,
            name: config.name,
            command: config.command,
            available,
        });
    }

    return results.filter((ide) => ide.available);
};

export const isIDEAvailable = async (type: IDEType): Promise<boolean> => {
    const config = IDE_CONFIGS.find((c) => c.type === type);
    if (!config) {
        return false;
    }
    return isIDEAvailableByConfig(config);
};

export const openInIDE = async (type: IDEType, path: string): Promise<void> => {
    const config = IDE_CONFIGS.find((c) => c.type === type);
    if (!config) {
        throw new Error(`Unknown IDE type: ${type}`);
    }

    const available = await isIDEAvailableByConfig(config);
    if (!available) {
        throw new Error(`IDE ${config.name} is not available on this system`);
    }

    const platform = process.platform;

    console.log('process.platform:', process.platform);

    try {
        // For macOS, try using 'open -a' if the app bundle exists
        if (platform === 'darwin') {
            const appPath = config.paths?.darwin?.[0];
            const pathExists = await checkPathExists(path);

            console.log('path exists', pathExists);
            if (appPath && pathExists) {
                console.log('open -a ${config.name} ${path}:', `open -a ${config.name} ${path}`);
                await $`open -a "${config.name}" "${path}"`;
                return;
            }
        }

        // Fall back to direct command execution
        await $`${config.command} ${path}`;
    } catch (error) {
        throw new Error(
            `Failed to launch ${config.name}: ${error instanceof Error ? error.message : String(error)}`
        );
    }
};

export const getIDEDisplayName = (type: IDEType): string => {
    const config = IDE_CONFIGS.find((c) => c.type === type);
    return config?.name || type;
};

// Namespace export for consistency with other managers
export const ide = {
    detectAvailableIDEs,
    isIDEAvailable,
    openInIDE,
    getIDEDisplayName,
};
