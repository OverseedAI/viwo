import { Command } from 'commander';
import { viwo } from '@viwo/core';

export const migrateCommand = new Command('migrate')
    .description('Runs sqlite database migrations.')
    .option('-v, --verbose', 'Verbose mode')
    .action((options) => {
        viwo.migrate(Boolean(options.verbose));
    });
