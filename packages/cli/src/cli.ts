#!/usr/bin/env bun

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
    startCommand,
    listCommand,
    getCommand,
    cleanupCommand,
    repoCommand,
    migrateCommand,
    authCommand,
    versionCommand,
} from './commands';

const __dirname = dirname(fileURLToPath(import.meta.url));

const getVersion = (): string => {
    try {
        const packageJsonPath = join(__dirname, '../package.json');
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        return packageJson.version;
    } catch (error) {
        return '0.1.0';
    }
};

const program = new Command();

program
    .name('viwo')
    .description('AI-powered development environment orchestrator')
    .version(getVersion());

// Register commands
program.addCommand(startCommand);
program.addCommand(listCommand);
program.addCommand(getCommand);
program.addCommand(cleanupCommand);
program.addCommand(repoCommand);
program.addCommand(migrateCommand);
program.addCommand(authCommand);
program.addCommand(versionCommand);

// Parse command line arguments
program.parse();
