import { $ } from 'bun';
import { access, constants, exists } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { IDEType, IDEInfo } from '../types';

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
            darwin: [
                '/Applications/IntelliJ IDEA.app',
                '/Applications/IntelliJ IDEA Ultimate.app',
            ],
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
            darwin: [
                '/Applications/IntelliJ IDEA CE.app',
                '/Applications/IntelliJ IDEA Community Edition.app',
            ],
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

const isExecutable = async (path: string): Promise<boolean> => {
    try {
        await access(path, constants.X_OK);
        return true;
    } catch {
        return false;
    }
};

// Helper: Cross-platform command check
const findCommandPath = async (command: string): Promise<string | null> => {
    try {
        // 'Bun.which' is efficient and cross-platform
        const path = await Bun.which(command);
        return path || null;
    } catch {
        return null;
    }
};

// Returns the executable string (either a command like 'code' or a path like '/opt/...')
const resolveLaunchStrategy = async (config: IDEConfig): Promise<string | null> => {
    // 1. Check PATH first (fastest/preferred)
    const cmdPath = await findCommandPath(config.command);
    if (cmdPath) return config.command; // It's in PATH, so we can just call the command

    // 2. Check Hardcoded Paths
    const platform = process.platform as 'darwin' | 'linux' | 'win32';
    const platformPaths = config.paths?.[platform];

    if (platformPaths) {
        // Parallelize filesystem checks for this specific IDE
        const checks = await Promise.all(
            platformPaths.map(async (p) => ({ path: p, exists: await isExecutable(p) }))
        );
        const found = checks.find((c) => c.exists);
        if (found) return found.path;
    }

    return null;
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
    // 3. Run ALL IDE checks in parallel
    const strategies = await Promise.all(
        IDE_CONFIGS.map(async (config) => {
            const strategy = await resolveLaunchStrategy(config);
            return { config, strategy };
        })
    );

    return strategies
        .filter((item) => item.strategy !== null)
        .map(({ config }) => ({
            type: config.type,
            name: config.name,
            command: config.command, // Keep original command name for display
            available: true,
        }));
};

export const isIDEAvailable = async (type: IDEType): Promise<boolean> => {
    const config = IDE_CONFIGS.find((c) => c.type === type);
    if (!config) {
        return false;
    }
    return isIDEAvailableByConfig(config);
};

export const openInIDE = async (type: IDEType, targetPath: string): Promise<void> => {
    const config = IDE_CONFIGS.find((c) => c.type === type);
    if (!config) throw new Error(`Unknown IDE type: ${type}`);

    // Resolve target path to absolute to avoid CWD ambiguity
    const absolutePath = resolve(targetPath);

    // Re-detect how to run it (or you could cache this in detectAvailableIDEs)
    const execCommand = await resolveLaunchStrategy(config);
    if (!execCommand) throw new Error(`${config.name} not found`);

    const platform = process.platform;

    try {
        if (platform === 'darwin') {
            // macOS Specifics: Use 'open' if it looks like an App Bundle,
            // otherwise execute directly.
            if (execCommand.includes('.app')) {
                // Open via bundle name to ensure it attaches to running instance
                await $`open -a "${config.name}" "${absolutePath}"`;
                return;
            }
        }

        // Universal fallback: execute the command or absolute path
        // Note: We use the `execCommand` we resolved earlier, which might be
        // '/usr/local/bin/code' if it wasn't in PATH but exists on disk.
        await $`${execCommand} "${absolutePath}"`;
    } catch (error) {
        throw new Error(`Failed to launch ${config.name}`);
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
