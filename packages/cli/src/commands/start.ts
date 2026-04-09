import { Command } from 'commander';
import chalk from 'chalk';
import * as clack from '@clack/prompts';
import { readFileSync } from 'fs';
import { viwo, ConfigManager, GitHubManager, GitManager } from '@viwo/core';
import { getStatusBadge } from '../utils/formatters';
import { preflightChecksOrExit } from '../utils/prerequisites';
import { multilineInput } from '../utils/multiline-input';

export const startCommand = new Command('start')
    .description('Initialize a new worktree session with an AI agent')
    .option('-r, --repo <id>', 'Repository ID to use')
    .option('-a, --agent <agent>', 'AI agent to use', 'claude-code')
    .option('-b, --branch <branch>', 'Custom branch name')
    .option('-c, --compose <path>', 'Path to docker-compose.yml')
    .option('-e, --env <path>', 'Path to .env file to copy')
    .option('-s, --setup <commands...>', 'Setup commands to run')
    .option('-p, --prompt <text>', 'Prompt text for the AI agent (skips interactive input)')
    .option('--prompt-file <path>', 'Path to file containing the prompt')
    .option('--no-sync', 'Skip syncing Docker state before starting')
    .action(async (options) => {
        try {
            // Run preflight checks before proceeding
            await preflightChecksOrExit();

            // Ensure authentication is configured before proceeding
            if (!ConfigManager.isAuthConfigured()) {
                console.log();
                console.log(chalk.red('Authentication is not configured.'));
                console.log();
                console.log(chalk.yellow('Run the following command to set up authentication:'));
                console.log(chalk.cyan('  viwo auth'));
                console.log();
                process.exit(1);
            }

            // Sync Docker state with database before starting
            if (options.sync !== false) {
                await viwo.sync();
            }

            clack.intro(chalk.bgCyan(' viwo start '));

            // Step 1: Select repository
            let repoId: number;

            if (options.repo) {
                repoId = parseInt(options.repo, 10);
                if (isNaN(repoId)) {
                    clack.cancel('Invalid repository ID');
                    process.exit(1);
                }
            } else {
                const repositories = viwo.repo.list({ archived: false, orderByRecentlyUsed: true });

                if (repositories.length === 0) {
                    clack.cancel('No repositories found.');
                    console.log();
                    console.log(chalk.yellow('Add a repository first:'));
                    console.log(chalk.gray('  viwo repo add <path> --name <name>'));
                    console.log();
                    process.exit(1);
                }

                const selectedRepo = await clack.select({
                    message: 'Select a repository',
                    options: repositories.map((repo) => ({
                        label: repo.name,
                        value: repo.id,
                        hint: repo.path,
                    })),
                });

                if (clack.isCancel(selectedRepo)) {
                    clack.cancel('Operation cancelled.');
                    process.exit(0);
                }

                repoId = selectedRepo;
            }

            // Step 2: Get branch name
            let branchName: string | undefined = options.branch;

            if (branchName) {
                const validationError = GitManager.validateBranchName(branchName);
                if (validationError) {
                    clack.log.error(chalk.red(validationError));
                    process.exit(1);
                }
            } else {
                const branchInput = await clack.text({
                    message: 'Branch name',
                    placeholder: 'Leave empty for auto-generated',
                    validate: (value) => {
                        if (!value || !value.trim()) return undefined;
                        return GitManager.validateBranchName(value.trim());
                    },
                });

                if (clack.isCancel(branchInput)) {
                    clack.cancel('Operation cancelled.');
                    process.exit(0);
                }

                if (branchInput && branchInput.trim()) {
                    branchName = branchInput.trim();
                }
            }

            // Step 3: Get prompt
            let prompt: string;

            if (options.prompt) {
                prompt = options.prompt;
            } else if (options.promptFile) {
                try {
                    prompt = readFileSync(options.promptFile, 'utf-8').trim();
                } catch {
                    clack.cancel(`Failed to read prompt file: ${options.promptFile}`);
                    process.exit(1);
                }

                if (!prompt) {
                    clack.cancel('Prompt file is empty');
                    process.exit(1);
                }
            } else {
                prompt = await multilineInput({
                    message: 'Enter your prompt for the AI agent:',
                });
            }

            // If prompt contains GitHub issue URLs and no token is stored, offer setup
            const issueUrls = GitHubManager.parseIssueUrls(prompt);
            if (issueUrls.length > 0 && !ConfigManager.hasGitHubToken()) {
                clack.log.info(
                    `Detected ${issueUrls.length} GitHub issue URL(s). A GitHub token is needed to fetch issue context.`
                );

                const setupChoice = await clack.select({
                    message: 'Set up GitHub token now?',
                    options: [
                        { label: 'Auto-detect (gh CLI / env var)', value: 'auto' },
                        { label: 'Enter token manually', value: 'manual' },
                        { label: 'Skip — continue without issue context', value: 'skip' },
                    ],
                });

                if (clack.isCancel(setupChoice)) {
                    clack.cancel('Operation cancelled.');
                    process.exit(0);
                }

                if (setupChoice === 'auto') {
                    let resolved = await GitHubManager.resolveGitHubTokenFromGhCli();
                    if (!resolved) resolved = GitHubManager.resolveGitHubTokenFromEnv();

                    if (resolved) {
                        ConfigManager.setGitHubToken(resolved);
                        clack.log.success('GitHub token saved.');
                    } else {
                        clack.log.warn(
                            'No token found. Install gh CLI (gh auth login) or set GITHUB_TOKEN env var.'
                        );
                    }
                } else if (setupChoice === 'manual') {
                    const tokenInput = await clack.password({
                        message: 'Enter your GitHub personal access token:',
                    });

                    if (clack.isCancel(tokenInput)) {
                        clack.cancel('Operation cancelled.');
                        process.exit(0);
                    }

                    if (tokenInput && tokenInput.trim()) {
                        ConfigManager.setGitHubToken(tokenInput.trim());
                        clack.log.success('GitHub token saved.');
                    }
                }
            }

            // Create session
            const spinner = clack.spinner();
            spinner.start('Initializing worktree session...');

            const session = await viwo.start({
                repoId,
                prompt,
                agent: options.agent,
                branchName,
                dockerCompose: options.compose,
                envFile: options.env,
                setupCommands: options.setup,
            });

            spinner.stop('Session created successfully!');

            console.log();
            console.log(chalk.bold('Session Details'));
            console.log();
            console.log(`  ${chalk.cyan('ID:')}         ${session.id}`);
            console.log(`  ${chalk.cyan('Branch:')}     ${session.branchName}`);
            console.log(`  ${chalk.cyan('Worktree:')}   ${session.worktreePath}`);
            console.log(`  ${chalk.cyan('Agent:')}      ${session.agent.type}`);
            console.log(`  ${chalk.cyan('Status:')}     ${getStatusBadge(session.status)}`);
            if (session.containerName) {
                console.log(`  ${chalk.cyan('Container:')}  ${session.containerName}`);
            }

            console.log();
            console.log(chalk.dim('Container is running in the background.'));
            console.log();
            console.log(`  Attach:  ${chalk.cyan(`viwo attach ${session.id}`)}`);
            console.log(`  Detach:  ${chalk.dim('Ctrl+B, D (inside tmux)')}`);
            console.log();
            clack.outro('Session ready!');
            process.exit(0);
        } catch (error) {
            clack.cancel(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });
