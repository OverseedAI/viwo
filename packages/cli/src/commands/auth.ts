import { Command } from 'commander';
import chalk from 'chalk';
import * as clack from '@clack/prompts';
import { ConfigManager } from '@viwo/core';

const PROVIDERS = [
    {
        value: 'anthropic' as const,
        label: 'Anthropic',
        hint: 'Claude API key',
    },
];

export const authCommand = new Command('auth')
    .description('Configure API keys for AI providers')
    .action(async () => {
        try {
            clack.intro(chalk.bgCyan(' viwo auth '));

            // Step 1: Select provider
            const selectedProvider = await clack.select({
                message: 'Select an API provider to configure',
                options: PROVIDERS.map((provider) => ({
                    label: provider.label,
                    value: provider.value,
                    hint: provider.hint,
                })),
            });

            if (clack.isCancel(selectedProvider)) {
                clack.cancel('Operation cancelled.');
                process.exit(0);
            }

            // Step 2: Get API key with masked input
            const apiKey = await clack.password({
                message: `Enter your ${PROVIDERS.find((p) => p.value === selectedProvider)?.label} API key`,
                validate: (value) => {
                    if (!value || !value.trim()) {
                        return 'API key cannot be empty';
                    }
                    if (selectedProvider === 'anthropic' && !value.startsWith('sk-ant-')) {
                        return 'Anthropic API keys should start with "sk-ant-"';
                    }
                },
            });

            if (clack.isCancel(apiKey)) {
                clack.cancel('Operation cancelled.');
                process.exit(0);
            }

            // Step 3: Save the API key
            const spinner = clack.spinner();
            spinner.start('Saving API key...');

            await ConfigManager.setApiKey({
                provider: selectedProvider,
                key: apiKey,
            });

            spinner.stop('API key saved successfully!');

            clack.outro(chalk.green('Authentication configured!'));
        } catch (error) {
            clack.cancel(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });
