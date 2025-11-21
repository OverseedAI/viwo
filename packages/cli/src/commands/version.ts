import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const getVersion = (): string => {
    try {
        const packageJsonPath = join(__dirname, '../../package.json');
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        return packageJson.version;
    } catch (error) {
        return 'unknown';
    }
};

export const versionCommand = new Command('version')
    .description('Display the version of VIWO CLI')
    .action(() => {
        const version = getVersion();
        console.log(chalk.cyan(`VIWO CLI v${version}`));
    });
