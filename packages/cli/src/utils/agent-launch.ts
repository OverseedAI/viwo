import * as clack from '@clack/prompts';
import {
    viwo,
    ConfigManager,
    GitHubManager,
    GitLabManager,
    ProjectConfigManager,
} from '@viwo/core';

export interface PrepareAgentLaunchOptions {
    prompt?: string;
    promptFile?: string;
}

const readPromptFile = async (promptFile: string): Promise<string> => {
    const file = Bun.file(promptFile);
    if (!(await file.exists())) {
        throw new Error(`Failed to read prompt file: ${promptFile}`);
    }

    const content = (await file.text()).trim();
    if (!content) {
        throw new Error('Prompt file is empty');
    }

    return content;
};

export const preparePromptForLaunch = async (
    options: PrepareAgentLaunchOptions
): Promise<string> => {
    let prompt: string;

    if (options.prompt) {
        prompt = options.prompt;
    } else if (options.promptFile) {
        prompt = await readPromptFile(options.promptFile);
    } else {
        const { multilineInput } = await import('./multiline-input');
        prompt = await multilineInput({
            message: 'Enter your prompt for the AI agent:',
        });
    }

    if (!ConfigManager.isAuthConfigured()) {
        throw new Error(
            'Authentication is not configured. Run "viwo auth" to set up authentication.'
        );
    }

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
            throw new Error('Operation cancelled.');
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
                throw new Error('Operation cancelled.');
            }

            if (tokenInput && tokenInput.trim()) {
                ConfigManager.setGitHubToken(tokenInput.trim());
                clack.log.success('GitHub token saved.');
            }
        }
    }

    const gitlabUrls = GitLabManager.parseGitLabResourceUrls(prompt);
    if (gitlabUrls.length > 0 && !ConfigManager.hasGitLabToken()) {
        clack.log.info(
            `Detected ${gitlabUrls.length} GitLab issue/MR URL(s). A GitLab token is needed to fetch context.`
        );

        const setupChoice = await clack.select({
            message: 'Set up GitLab token now?',
            options: [
                { label: 'Auto-detect (glab CLI / env var)', value: 'auto' },
                { label: 'Enter token manually', value: 'manual' },
                { label: 'Skip — continue without GitLab context', value: 'skip' },
            ],
        });

        if (clack.isCancel(setupChoice)) {
            throw new Error('Operation cancelled.');
        }

        if (setupChoice === 'auto') {
            let resolved = await GitLabManager.resolveGitLabTokenFromGlabCli();
            if (!resolved) resolved = GitLabManager.resolveGitLabTokenFromEnv();

            if (resolved) {
                ConfigManager.setGitLabToken(resolved);
                clack.log.success('GitLab token saved.');
            } else {
                clack.log.warn(
                    'No token found. Install glab CLI (glab auth login) or set GITLAB_TOKEN env var.'
                );
            }
        } else if (setupChoice === 'manual') {
            const tokenInput = await clack.password({
                message: 'Enter your GitLab personal access token:',
            });

            if (clack.isCancel(tokenInput)) {
                throw new Error('Operation cancelled.');
            }

            if (tokenInput && tokenInput.trim()) {
                ConfigManager.setGitLabToken(tokenInput.trim());
                clack.log.success('GitLab token saved.');
            }
        }
    }

    let expandedPrompt = prompt;
    expandedPrompt = await GitHubManager.expandPromptWithIssues(expandedPrompt);
    expandedPrompt = await GitLabManager.expandPromptWithGitLabResources(expandedPrompt);

    return expandedPrompt;
};

const normalizeAgentType = (agent?: string): 'claude-code' | 'cline' | 'cursor' => {
    if (agent === 'cline' || agent === 'cursor') {
        return agent;
    }

    return 'claude-code';
};

export const launchAgentForSession = async (options: {
    sessionId: string;
    worktreePath: string;
    repoPath: string;
    prompt?: string;
    promptFile?: string;
    agent?: string;
}): Promise<void> => {
    const expandedPrompt = await preparePromptForLaunch({
        prompt: options.prompt,
        promptFile: options.promptFile,
    });

    const projectConfig = ProjectConfigManager.loadProjectConfig({
        repoPath: options.repoPath,
    }) as { preAgent?: string[] } | null;

    await (viwo.startContainer as any)({
        sessionId: parseInt(options.sessionId, 10),
        worktreePath: options.worktreePath,
        prompt: expandedPrompt,
        agent: normalizeAgentType(options.agent),
        model: ConfigManager.getPreferredModel() ?? 'sonnet',
        preAgentCommands: projectConfig?.preAgent,
    });
};
