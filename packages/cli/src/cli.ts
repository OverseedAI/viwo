#!/usr/bin/env bun

import { Command } from 'commander';
import {
    startCommand,
    listCommand,
    getCommand,
    cleanupCommand,
    cleanCommand,
    repoCommand,
    migrateCommand,
    authCommand,
    registerCommand,
} from './commands';
import packageJson from '../package.json';

const program = new Command();

program
    .name('viwo')
    .description('AI-powered development environment orchestrator')
    .version(packageJson.version);

// Register commands
program.addCommand(startCommand);
program.addCommand(listCommand);
program.addCommand(getCommand);
program.addCommand(cleanupCommand);
program.addCommand(cleanCommand);
program.addCommand(repoCommand);
program.addCommand(migrateCommand);
program.addCommand(authCommand);
program.addCommand(registerCommand);

// Parse command line arguments
program.parse();
