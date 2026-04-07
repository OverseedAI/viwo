import { Command } from 'commander';
import chalk from 'chalk';
import * as clack from '@clack/prompts';
import { ConfigManager, CredentialManager } from '@viwo/core';

const getAuthMethods = () => {
    const methods = [
        {
            value: 'oauth' as const,
            label: 'Use Claude subscription',
            hint: 'Auto-detect from Claude Code login (Max, Pro, Teams)',
        },
        {
            value: 'api-key' as const,
            label: 'Use Anthropic API key',
            hint: 'Enter an sk-ant-... key manually',
        },
    ];

    // OAuth is only supported on macOS and Linux
    if (process.platform === 'win32') {
        return methods.filter((m) => m.value !== 'oauth');
    }

    return methods;
};

const configureOAuth = async (): Promise<void> => {
    const spinner = clack.spinner();
    spinner.start('Detecting Claude subscription credentials...');

    const summary = await CredentialManager.getCredentialSummary();

    if (!summary) {
        spinner.stop('No Claude subscription detected.');
        clack.log.error(
            'Could not find Claude Code OAuth credentials.\n' +
                '  Make sure you have Claude Code installed and logged in.\n' +
                '  Run "claude" on your host to authenticate first.'
        );
        return;
    }

    spinner.stop('Claude subscription detected!');

    clack.log.info(
        [
            `Email: ${chalk.cyan(summary.emailAddress)}`,
            summary.organizationName
                ? `Organization: ${chalk.cyan(summary.organizationName)}`
                : null,
            summary.subscriptionType
                ? `Subscription: ${chalk.cyan(summary.subscriptionType)}`
                : null,
            `Token expires: ${chalk.cyan(summary.expiresAt.toLocaleString())}${summary.tokenExpired ? chalk.yellow(' (expired - will refresh automatically)') : ''}`,
        ]
            .filter(Boolean)
            .join('\n')
    );

    const confirmed = await clack.confirm({
        message: 'Use this subscription for VIWO sessions?',
    });

    if (clack.isCancel(confirmed) || !confirmed) {
        clack.cancel('Operation cancelled.');
        process.exit(0);
    }

    ConfigManager.setAuthMethod('oauth');
    clack.log.success('Authentication method set to Claude subscription.');
    clack.log.info('Credentials will be read from your Claude Code login at each session start.');
};

const configureApiKey = async (): Promise<void> => {
    const apiKey = await clack.password({
        message: 'Enter your Anthropic API key',
        validate: (value) => {
            if (!value || !value.trim()) {
                return 'API key cannot be empty';
            }
            if (!value.startsWith('sk-ant-')) {
                return 'Anthropic API keys should start with "sk-ant-"';
            }
        },
    });

    if (clack.isCancel(apiKey)) {
        clack.cancel('Operation cancelled.');
        process.exit(0);
    }

    const spinner = clack.spinner();
    spinner.start('Saving API key...');

    await ConfigManager.setApiKey({ provider: 'anthropic', key: apiKey });
    ConfigManager.setAuthMethod('api-key');

    spinner.stop('API key saved successfully!');
};

export const authCommand = new Command('auth')
    .description('Configure authentication for AI providers')
    .action(async () => {
        try {
            clack.intro(chalk.bgCyan(' viwo auth '));

            const currentMethod = ConfigManager.getAuthMethod();
            clack.log.info(`Current auth method: ${chalk.cyan(currentMethod)}`);

            // Show Windows warning if OAuth is not available
            if (process.platform === 'win32') {
                clack.log.warn(
                    'OAuth authentication is not yet supported on Windows.\n' +
                        '  You can use an Anthropic API key instead.'
                );
            }

            const authMethods = getAuthMethods();
            const selectedMethod = await clack.select({
                message: 'Select authentication method',
                options: authMethods.map((method) => ({
                    label: method.label,
                    value: method.value,
                    hint: method.hint,
                })),
            });

            if (clack.isCancel(selectedMethod)) {
                clack.cancel('Operation cancelled.');
                process.exit(0);
            }

            if (selectedMethod === 'oauth') {
                await configureOAuth();
            } else {
                await configureApiKey();
            }

            clack.outro(chalk.green('Authentication configured!'));
        } catch (error) {
            clack.cancel(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });
