#!/usr/bin/env bun

import { Command } from 'commander';
import {
    startCommand,
    listCommand,
    cleanCommand,
    repoCommand,
    migrateCommand,
    authCommand,
    registerCommand,
    configCommand,
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
program.addCommand(cleanCommand);
program.addCommand(repoCommand);
program.addCommand(migrateCommand);
program.addCommand(authCommand);
program.addCommand(registerCommand);
program.addCommand(configCommand);

// Parse command line arguments
program.parse();
