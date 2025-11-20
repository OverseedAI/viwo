#!/usr/bin/env bun

import { Command } from 'commander';
import {
    startCommand,
    listCommand,
    getCommand,
    cleanupCommand,
    repoCommand,
    migrateCommand,
} from './commands';

const program = new Command();

program
    .name('viwo')
    .description('AI-powered development environment orchestrator')
    .version('0.1.0');

// Register commands
program.addCommand(startCommand);
program.addCommand(listCommand);
program.addCommand(getCommand);
program.addCommand(cleanupCommand);
program.addCommand(repoCommand);
program.addCommand(migrateCommand);

// Parse command line arguments
program.parse();
