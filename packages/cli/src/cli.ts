#!/usr/bin/env bun

import { Command } from 'commander';
import { initCommand, listCommand, getCommand, cleanupCommand, repoCommand } from './commands';

const program = new Command();

program
    .name('viwo')
    .description('AI-powered development environment orchestrator')
    .version('0.1.0');

// Register commands
program.addCommand(initCommand);
program.addCommand(listCommand);
program.addCommand(getCommand);
program.addCommand(cleanupCommand);
program.addCommand(repoCommand);

// Parse command line arguments
program.parse();
