import { Command } from 'commander';
import chalk from 'chalk';

const getUpdateInstructions = (): string => {
    const platform = process.platform;

    switch (platform) {
        case 'darwin':
            return `To update VIWO on macOS, run:

${chalk.cyan('curl -fsSL https://raw.githubusercontent.com/yourusername/viwo/main/install.sh | bash')}`;

        case 'win32':
            return `To update VIWO on Windows, run in PowerShell:

${chalk.cyan('irm https://raw.githubusercontent.com/yourusername/viwo/main/install.ps1 | iex')}`;

        case 'linux':
            return `To update VIWO on Linux, run:

${chalk.cyan('curl -fsSL https://raw.githubusercontent.com/yourusername/viwo/main/install.sh | bash')}`;

        default:
            return `To update VIWO on your system, download the latest release from:

${chalk.cyan('https://github.com/yourusername/viwo/releases/latest')}`;
    }
};

export const updateCommand = new Command('update')
    .description('Show instructions for updating VIWO to the latest version')
    .action(() => {
        console.log(chalk.bold('\nVIWO Update Instructions\n'));
        console.log(getUpdateInstructions());
        console.log(
            chalk.dim(
                '\nFor more information, visit: https://github.com/yourusername/viwo#installation'
            )
        );
    });
