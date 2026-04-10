#!/usr/bin/env bun

import { Command } from 'commander';
import {
    startCommand,
    createCommand,
    listCommand,
    cleanCommand,
    repoCommand,
    migrateCommand,
    authCommand,
    registerCommand,
    configCommand,
    updateCommand,
    attachCommand,
} from './commands';
import packageJson from '../package.json';

const program = new Command();

program
    .name('viwo')
    .description('git worktree + containerization + agent harness')
    .version(packageJson.version);

// Register commands
program.addCommand(startCommand);
program.addCommand(createCommand);
program.addCommand(listCommand);
program.addCommand(cleanCommand);
program.addCommand(repoCommand);
program.addCommand(migrateCommand);
program.addCommand(authCommand);
program.addCommand(registerCommand);
program.addCommand(configCommand);
program.addCommand(updateCommand);
program.addCommand(attachCommand);

// Parse command line arguments
program.parse();
