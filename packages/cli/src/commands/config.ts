import { Command } from 'commander';
import { select, input, password } from '@inquirer/prompts';
import chalk from 'chalk';
import {
    IDEManager,
    ConfigManager,
    GitHubManager,
    type IDEType,
    type IDEInfo,
    type ModelType,
    AppPaths,
} from '@viwo/core';
import { isAbsolute } from 'path';
import { preflightChecksOrExit } from '../utils/prerequisites';

// ─── Helpers to get current value summaries ─────────────────────────────────

const getCurrentIDESummary = (): string => {
    const pref = ConfigManager.getPreferredIDE();
    return pref ? IDEManager.getIDEDisplayName(pref) : chalk.gray('not set');
};

const getCurrentWorktreesSummary = (): string => {
    const loc = ConfigManager.getWorktreesStorageLocation();
    return loc ?? chalk.gray('default');
};

const getCurrentAuthSummary = (): string => {
    const hasKey = ConfigManager.hasApiKey({ provider: 'anthropic' });
    return hasKey ? chalk.green('configured') : chalk.gray('not set');
};

const MODEL_INFO: Record<ModelType, { name: string; hint: string }> = {
    opus: { name: 'Claude Opus', hint: 'Most capable, slowest' },
    sonnet: { name: 'Claude Sonnet', hint: 'Balanced speed and intelligence' },
    haiku: { name: 'Claude Haiku', hint: 'Fastest, least capable' },
};

const getCurrentGitHubSummary = (): string => {
    const hasToken = ConfigManager.hasGitHubToken();
    return hasToken ? chalk.green('configured') : chalk.gray('not set');
};

const getCurrentModelSummary = (): string => {
    const pref = ConfigManager.getPreferredModel();
    return pref ? MODEL_INFO[pref].name : chalk.gray('default (Sonnet)');
};

// ─── IDE configuration flow ─────────────────────────────────────────────────

const runIDEConfig = async (): Promise<void> => {
    console.clear();
    console.log();
    console.log(chalk.bold.cyan('IDE Configuration'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log();

    const availableIDEs = await IDEManager.detectAvailableIDEs();

    if (availableIDEs.length === 0) {
        console.log(chalk.yellow('No supported IDEs detected'));
        console.log();
        console.log(chalk.gray('Install one of the following:'));
        console.log(chalk.cyan('  VSCode:    ') + chalk.gray('https://code.visualstudio.com'));
        console.log(chalk.cyan('  Cursor:    ') + chalk.gray('https://cursor.sh'));
        console.log(chalk.cyan('  JetBrains: ') + chalk.gray('https://www.jetbrains.com'));
        console.log();
        return;
    }

    const currentPreference = ConfigManager.getPreferredIDE();

    console.log(chalk.bold('Current Default IDE'));
    if (currentPreference) {
        console.log(
            chalk.gray('  ') +
                chalk.green(IDEManager.getIDEDisplayName(currentPreference)) +
                chalk.gray(` (${currentPreference})`)
        );
    } else {
        console.log(chalk.gray('  None - you will be prompted to choose each time'));
    }
    console.log();

    const choices = availableIDEs.map((ide: IDEInfo) => ({
        name: ide.type === currentPreference ? `${ide.name} ${chalk.green('(current)')}` : ide.name,
        value: ide.type,
        description: ide.command,
    }));

    type IDEAction = '__separator__' | '__remove__' | '__cancel__';
    type IDESelection = IDEType | IDEAction;

    const actionChoices: { name: string; value: IDESelection; description: string }[] = [
        { name: chalk.gray('─'.repeat(50)), value: '__separator__', description: '' },
        {
            name: chalk.yellow('Remove default IDE'),
            value: '__remove__',
            description: 'You will be prompted to choose each time',
        },
        { name: chalk.gray('Cancel'), value: '__cancel__', description: 'Go back without changes' },
    ];

    const selection = await select<IDESelection>({
        message: 'Select your default IDE:',
        choices: [...choices, ...actionChoices],
        pageSize: 15,
    });

    if (selection === '__cancel__' || selection === '__separator__') {
        console.log(chalk.gray('No changes made'));
        console.log();
        return;
    }

    if (selection === '__remove__') {
        if (!currentPreference) {
            console.log(chalk.yellow('No default IDE is currently set'));
            console.log();
            return;
        }

        const confirmRemove = await select<boolean>({
            message: chalk.yellow(
                `Remove ${IDEManager.getIDEDisplayName(currentPreference)} as default IDE?`
            ),
            choices: [
                { name: 'No, cancel', value: false },
                { name: 'Yes, remove', value: true },
            ],
        });

        if (confirmRemove) {
            ConfigManager.deletePreferredIDE();
            console.log(chalk.green('✓ Default IDE removed'));
        } else {
            console.log(chalk.gray('No changes made'));
        }
        console.log();
        return;
    }

    const ideSelection = selection as IDEType;

    if (ideSelection === currentPreference) {
        console.log(
            chalk.yellow(
                `${IDEManager.getIDEDisplayName(ideSelection)} is already your default IDE`
            )
        );
        console.log();
        return;
    }

    ConfigManager.setPreferredIDE(ideSelection);
    console.log(chalk.green(`✓ Set ${IDEManager.getIDEDisplayName(ideSelection)} as default IDE`));
    console.log();
};

// ─── Worktrees configuration flow ───────────────────────────────────────────

const runWorktreesLocationConfig = async (): Promise<void> => {
    console.clear();
    console.log();
    console.log(chalk.bold.cyan('Worktrees Storage Location'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log();

    const currentLocation = ConfigManager.getWorktreesStorageLocation();
    const defaultLocation = AppPaths.joinDataPath('worktrees');

    console.log(chalk.bold('Current Worktrees Location'));
    if (currentLocation) {
        console.log(chalk.gray('  ') + chalk.green(currentLocation));
    } else {
        console.log(chalk.gray('  ') + chalk.yellow('Default: ') + chalk.white(defaultLocation));
    }
    console.log();

    const action = await select<string>({
        message: 'What would you like to do?',
        choices: [
            {
                name: chalk.cyan('Set custom location'),
                value: 'set',
                description: 'Specify a custom directory for git worktrees',
            },
            {
                name: chalk.yellow('Reset to default'),
                value: 'reset',
                description: `Use default location: ${defaultLocation}`,
            },
            {
                name: chalk.gray('Cancel'),
                value: 'cancel',
                description: 'Go back without changes',
            },
        ],
        pageSize: 10,
    });

    if (action === 'cancel') {
        console.log(chalk.gray('No changes made'));
        console.log();
        return;
    }

    if (action === 'reset') {
        if (!currentLocation) {
            console.log(chalk.yellow('Already using default location'));
            console.log();
            return;
        }

        const confirmReset = await select<boolean>({
            message: chalk.yellow('Reset worktrees location to default?'),
            choices: [
                { name: 'No, cancel', value: false },
                { name: 'Yes, reset', value: true },
            ],
        });

        if (confirmReset) {
            ConfigManager.deleteWorktreesStorageLocation();
            console.log(chalk.green('✓ Worktrees location reset to default'));
            console.log(chalk.gray('  ') + chalk.white(defaultLocation));
        } else {
            console.log(chalk.gray('No changes made'));
        }
        console.log();
        return;
    }

    if (action === 'set') {
        console.log();
        console.log(chalk.gray('Enter the path where git worktrees should be stored.'));
        console.log(chalk.gray('You can use:'));
        console.log(chalk.gray('  • Absolute path (e.g., /home/user/viwo-worktrees)'));
        console.log(chalk.gray('  • Tilde expansion (e.g., ~/.config/viwo)'));
        console.log(chalk.gray('  • Relative path (relative to ~/.viwo/)'));
        console.log();

        const newLocation = await input({
            message: 'Worktrees location:',
            default: currentLocation || defaultLocation,
            validate: (value: string) => {
                if (!value || value.trim() === '') {
                    return 'Location cannot be empty';
                }
                return true;
            },
        });

        const trimmedLocation = newLocation.trim();
        const expandedLocation = AppPaths.expandTilde(trimmedLocation);

        console.log();
        console.log(chalk.bold('New Worktrees Location'));
        console.log(chalk.gray('  ') + chalk.white(trimmedLocation));
        if (!isAbsolute(expandedLocation)) {
            const resolvedPath = AppPaths.joinDataPath(expandedLocation);
            console.log(chalk.gray('  Resolved to: ') + chalk.cyan(resolvedPath));
        } else if (expandedLocation !== trimmedLocation) {
            console.log(chalk.gray('  Expands to: ') + chalk.cyan(expandedLocation));
        }
        console.log();

        const confirmSet = await select<boolean>({
            message: 'Save this location?',
            choices: [
                { name: 'Yes, save', value: true },
                { name: 'No, cancel', value: false },
            ],
        });

        if (confirmSet) {
            ConfigManager.setWorktreesStorageLocation(trimmedLocation);
            console.log(chalk.green('✓ Worktrees location updated'));
            console.log(chalk.gray('  ') + chalk.white(trimmedLocation));
        } else {
            console.log(chalk.gray('No changes made'));
        }
        console.log();
    }
};

// ─── Model preference configuration flow ──────────────────────────────────

const MODEL_CHOICES: ModelType[] = ['opus', 'sonnet', 'haiku'];

const runModelConfig = async (): Promise<void> => {
    console.clear();
    console.log();
    console.log(chalk.bold.cyan('Model Preference'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log();

    const currentPreference = ConfigManager.getPreferredModel();

    console.log(chalk.bold('Current Model'));
    if (currentPreference) {
        console.log(
            chalk.gray('  ') +
                chalk.green(MODEL_INFO[currentPreference].name) +
                chalk.gray(` (${currentPreference})`)
        );
    } else {
        console.log(chalk.gray('  Default: ') + chalk.white('Claude Sonnet'));
    }
    console.log();

    const choices = MODEL_CHOICES.map((model) => ({
        name:
            model === currentPreference
                ? `${MODEL_INFO[model].name} ${chalk.gray(`— ${MODEL_INFO[model].hint}`)} ${chalk.green('(current)')}`
                : `${MODEL_INFO[model].name} ${chalk.gray(`— ${MODEL_INFO[model].hint}`)}`,
        value: model,
    }));

    type ModelAction = '__separator__' | '__remove__' | '__cancel__';
    type ModelSelection = ModelType | ModelAction;

    const actionChoices: { name: string; value: ModelSelection }[] = [
        { name: chalk.gray('─'.repeat(50)), value: '__separator__' },
        { name: chalk.yellow('Reset to default (Sonnet)'), value: '__remove__' },
        { name: chalk.gray('Cancel'), value: '__cancel__' },
    ];

    const selection = await select<ModelSelection>({
        message: 'Select your preferred model:',
        choices: [...choices, ...actionChoices],
        pageSize: 10,
    });

    if (selection === '__cancel__' || selection === '__separator__') {
        console.log(chalk.gray('No changes made'));
        console.log();
        return;
    }

    if (selection === '__remove__') {
        if (!currentPreference) {
            console.log(chalk.yellow('Already using default (Sonnet)'));
            console.log();
            return;
        }

        ConfigManager.deletePreferredModel();
        console.log(chalk.green('✓ Model preference reset to default (Sonnet)'));
        console.log();
        return;
    }

    const modelSelection = selection as ModelType;

    if (modelSelection === currentPreference) {
        console.log(
            chalk.yellow(`${MODEL_INFO[modelSelection].name} is already your preferred model`)
        );
        console.log();
        return;
    }

    ConfigManager.setPreferredModel(modelSelection);
    console.log(chalk.green(`✓ Set ${MODEL_INFO[modelSelection].name} as preferred model`));
    console.log();
};

// ─── GitHub token configuration flow ────────────────────────────────────────

const runGitHubConfig = async (): Promise<void> => {
    console.clear();
    console.log();
    console.log(chalk.bold.cyan('GitHub Integration'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log();

    const hasToken = ConfigManager.hasGitHubToken();

    console.log(chalk.bold('GitHub Token'));
    if (hasToken) {
        console.log(chalk.gray('  ') + chalk.green('Configured'));
    } else {
        console.log(chalk.gray('  Not set'));
    }
    console.log();

    const action = await select<string>({
        message: 'What would you like to do?',
        choices: [
            {
                name: chalk.cyan('Auto-detect token'),
                value: 'auto',
                description: 'Try gh CLI, then GITHUB_TOKEN env var',
            },
            {
                name: chalk.cyan('Enter token manually'),
                value: 'manual',
                description: 'Paste a personal access token',
            },
            ...(hasToken
                ? [
                      {
                          name: chalk.yellow('Remove token'),
                          value: 'remove',
                          description: 'Delete stored GitHub token',
                      },
                  ]
                : []),
            {
                name: chalk.gray('Cancel'),
                value: 'cancel',
                description: 'Go back without changes',
            },
        ],
        pageSize: 10,
    });

    if (action === 'cancel') {
        console.log(chalk.gray('No changes made'));
        console.log();
        return;
    }

    if (action === 'remove') {
        ConfigManager.deleteGitHubToken();
        console.log(chalk.green('✓ GitHub token removed'));
        console.log();
        return;
    }

    if (action === 'auto') {
        console.log();
        console.log(chalk.gray('Checking gh CLI...'));

        const ghToken = await GitHubManager.resolveGitHubTokenFromGhCli();
        if (ghToken) {
            const confirm = await select<boolean>({
                message: 'Found token from gh CLI. Use it?',
                choices: [
                    { name: 'Yes, save it', value: true },
                    { name: 'No, cancel', value: false },
                ],
            });

            if (confirm) {
                ConfigManager.setGitHubToken(ghToken);
                console.log(chalk.green('✓ GitHub token saved from gh CLI'));
                console.log();
                return;
            }

            console.log(chalk.gray('No changes made'));
            console.log();
            return;
        }

        console.log(chalk.gray('Checking GITHUB_TOKEN env var...'));
        const envToken = GitHubManager.resolveGitHubTokenFromEnv();
        if (envToken) {
            const confirm = await select<boolean>({
                message: 'Found GITHUB_TOKEN in environment. Use it?',
                choices: [
                    { name: 'Yes, save it', value: true },
                    { name: 'No, cancel', value: false },
                ],
            });

            if (confirm) {
                ConfigManager.setGitHubToken(envToken);
                console.log(chalk.green('✓ GitHub token saved from environment'));
                console.log();
                return;
            }

            console.log(chalk.gray('No changes made'));
            console.log();
            return;
        }

        console.log(chalk.yellow('No GitHub token found automatically.'));
        console.log(chalk.gray('Install the gh CLI (gh auth login) or set GITHUB_TOKEN env var.'));
        console.log(chalk.gray('You can also enter a token manually.'));
        console.log();
        return;
    }

    if (action === 'manual') {
        const token = await password({
            message: 'Enter your GitHub personal access token',
            validate: (value) => {
                if (!value || !value.trim()) {
                    return 'Token cannot be empty';
                }
                return true;
            },
        });

        ConfigManager.setGitHubToken(token.trim());
        console.log(chalk.green('✓ GitHub token saved'));
        console.log();
    }
};

// ─── Authentication configuration flow ──────────────────────────────────────

const PROVIDERS = [
    {
        value: 'anthropic' as const,
        label: 'Anthropic',
        hint: 'Claude API key',
    },
];

const runAuthConfig = async (): Promise<void> => {
    console.clear();
    console.log();
    console.log(chalk.bold.cyan('Authentication'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log();

    const selectedProvider = await select({
        message: 'Select an API provider to configure',
        choices: [
            ...PROVIDERS.map((provider) => ({
                name: `${provider.label} ${ConfigManager.hasApiKey({ provider: provider.value }) ? chalk.green('(configured)') : chalk.gray('(not set)')}`,
                value: provider.value,
                description: provider.hint,
            })),
            {
                name: chalk.gray('Cancel'),
                value: '__cancel__' as const,
                description: 'Go back without changes',
            },
        ],
    });

    if (selectedProvider === '__cancel__') {
        console.log(chalk.gray('No changes made'));
        console.log();
        return;
    }

    const providerLabel = PROVIDERS.find((p) => p.value === selectedProvider)?.label;

    const apiKey = await password({
        message: `Enter your ${providerLabel} API key`,
        validate: (value) => {
            if (!value || !value.trim()) {
                return 'API key cannot be empty';
            }
            if (selectedProvider === 'anthropic' && !value.startsWith('sk-ant-')) {
                return 'Anthropic API keys should start with "sk-ant-"';
            }
            return true;
        },
    });

    await ConfigManager.setApiKey({
        provider: selectedProvider,
        key: apiKey,
    });

    console.log(chalk.green(`✓ ${providerLabel} API key saved`));
    console.log();
};

// ─── Main interactive config menu ───────────────────────────────────────────

const runConfigMenu = async (): Promise<void> => {
    await preflightChecksOrExit({ requireGit: false, requireDocker: false });

    let running = true;

    while (running) {
        console.clear();
        console.log();
        console.log(chalk.bold.cyan('viwo config'));
        console.log(chalk.gray('═'.repeat(50)));
        console.log();

        const choice = await select<string>({
            message: 'Select a setting to configure',
            choices: [
                {
                    name: `IDE preference          ${chalk.gray(`(${getCurrentIDESummary()})`)}`,
                    value: 'ide',
                },
                {
                    name: `Worktrees location      ${chalk.gray(`(${getCurrentWorktreesSummary()})`)}`,
                    value: 'worktrees',
                },
                {
                    name: `Model preference        ${chalk.gray(`(${getCurrentModelSummary()})`)}`,
                    value: 'model',
                },
                {
                    name: `GitHub integration      ${chalk.gray(`(${getCurrentGitHubSummary()})`)}`,
                    value: 'github',
                },
                {
                    name: `Authentication          ${chalk.gray(`(${getCurrentAuthSummary()})`)}`,
                    value: 'auth',
                },
                {
                    name: chalk.gray('Exit'),
                    value: 'exit',
                },
            ],
        });

        switch (choice) {
            case 'ide':
                await runIDEConfig();
                break;
            case 'worktrees':
                await runWorktreesLocationConfig();
                break;
            case 'model':
                await runModelConfig();
                break;
            case 'github':
                await runGitHubConfig();
                break;
            case 'auth':
                await runAuthConfig();
                break;
            case 'exit':
                running = false;
                break;
        }
    }
};

// ─── Command definitions ────────────────────────────────────────────────────

const ideCommand = new Command('ide')
    .description('Configure default IDE')
    .option('--set <ide>', 'Set default IDE by type name')
    .option('--reset', 'Remove default IDE preference')
    .action(async (options) => {
        try {
            await preflightChecksOrExit({ requireGit: false, requireDocker: false });

            // Non-interactive: --reset
            if (options.reset) {
                ConfigManager.deletePreferredIDE();
                console.log(chalk.green('Default IDE preference removed.'));
                return;
            }

            // Non-interactive: --set
            if (options.set) {
                const availableIDEs = await IDEManager.detectAvailableIDEs();
                const match = availableIDEs.find((ide: IDEInfo) => ide.type === options.set);

                if (!match) {
                    console.error(
                        chalk.red(
                            `IDE "${options.set}" not found. Available: ${availableIDEs.map((i: IDEInfo) => i.type).join(', ')}`
                        )
                    );
                    process.exit(1);
                }

                ConfigManager.setPreferredIDE(match.type);
                console.log(chalk.green(`Default IDE set to ${match.name}.`));
                return;
            }

            // Interactive path
            await runIDEConfig();
        } catch (error) {
            if ((error as any).name === 'ExitPromptError') {
                console.log(chalk.gray('Operation cancelled'));
                process.exit(0);
            }
            console.error(
                chalk.red('Configuration failed:'),
                error instanceof Error ? error.message : String(error)
            );
            process.exit(1);
        }
    });

const worktreesCommand = new Command('worktrees')
    .description('Configure worktrees storage location')
    .option('--set <path>', 'Set custom worktrees storage location')
    .option('--reset', 'Reset to default worktrees location')
    .action(async (options) => {
        try {
            await preflightChecksOrExit({ requireGit: false, requireDocker: false });

            // Non-interactive: --reset
            if (options.reset) {
                ConfigManager.deleteWorktreesStorageLocation();
                console.log(chalk.green('Worktrees location reset to default.'));
                return;
            }

            // Non-interactive: --set
            if (options.set) {
                const trimmed = options.set.trim();
                if (!trimmed) {
                    console.error(chalk.red('Location cannot be empty.'));
                    process.exit(1);
                }

                ConfigManager.setWorktreesStorageLocation(trimmed);
                console.log(chalk.green(`Worktrees location set to: ${trimmed}`));
                return;
            }

            // Interactive path
            await runWorktreesLocationConfig();
        } catch (error) {
            if ((error as any).name === 'ExitPromptError') {
                console.log(chalk.gray('Operation cancelled'));
                process.exit(0);
            }
            console.error(
                chalk.red('Configuration failed:'),
                error instanceof Error ? error.message : String(error)
            );
            process.exit(1);
        }
    });

const modelCommand = new Command('model')
    .description('Configure preferred Claude model')
    .option('--set <model>', 'Set preferred model (opus, sonnet, haiku)')
    .option('--reset', 'Reset to default model (Sonnet)')
    .action(async (options) => {
        try {
            await preflightChecksOrExit({ requireGit: false, requireDocker: false });

            // Non-interactive: --reset
            if (options.reset) {
                ConfigManager.deletePreferredModel();
                console.log(chalk.green('Model preference reset to default (Sonnet).'));
                return;
            }

            // Non-interactive: --set
            if (options.set) {
                const validModels: ModelType[] = ['opus', 'sonnet', 'haiku'];
                if (!validModels.includes(options.set as ModelType)) {
                    console.error(
                        chalk.red(
                            `Invalid model "${options.set}". Must be one of: ${validModels.join(', ')}`
                        )
                    );
                    process.exit(1);
                }

                ConfigManager.setPreferredModel(options.set as ModelType);
                console.log(
                    chalk.green(
                        `Preferred model set to ${MODEL_INFO[options.set as ModelType].name}.`
                    )
                );
                return;
            }

            // Interactive path
            await runModelConfig();
        } catch (error) {
            if ((error as any).name === 'ExitPromptError') {
                console.log(chalk.gray('Operation cancelled'));
                process.exit(0);
            }
            console.error(
                chalk.red('Configuration failed:'),
                error instanceof Error ? error.message : String(error)
            );
            process.exit(1);
        }
    });

const githubCommand = new Command('github')
    .description('Configure GitHub integration')
    .action(async () => {
        try {
            await preflightChecksOrExit({ requireGit: false, requireDocker: false });
            await runGitHubConfig();
        } catch (error) {
            if ((error as any).name === 'ExitPromptError') {
                console.log(chalk.gray('Operation cancelled'));
                process.exit(0);
            }
            console.error(
                chalk.red('Configuration failed:'),
                error instanceof Error ? error.message : String(error)
            );
            process.exit(1);
        }
    });

const authConfigCommand = new Command('auth')
    .description('Configure API key authentication')
    .action(async () => {
        try {
            await preflightChecksOrExit({ requireGit: false, requireDocker: false });
            await runAuthConfig();
        } catch (error) {
            if ((error as any).name === 'ExitPromptError') {
                console.log(chalk.gray('Operation cancelled'));
                process.exit(0);
            }
            console.error(
                chalk.red('Configuration failed:'),
                error instanceof Error ? error.message : String(error)
            );
            process.exit(1);
        }
    });

export const configCommand = new Command('config')
    .description('Manage VIWO configuration')
    .addCommand(ideCommand)
    .addCommand(worktreesCommand)
    .addCommand(modelCommand)
    .addCommand(githubCommand)
    .addCommand(authConfigCommand)
    .action(async () => {
        try {
            await runConfigMenu();
        } catch (error) {
            if ((error as any).name === 'ExitPromptError') {
                console.log();
                console.log(chalk.gray('Operation cancelled'));
                process.exit(0);
            }
            console.error(
                chalk.red('Configuration failed:'),
                error instanceof Error ? error.message : String(error)
            );
            process.exit(1);
        }
    });
