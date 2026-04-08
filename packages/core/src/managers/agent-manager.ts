import { AgentConfig, SessionStatus } from '../schemas';
import { db } from '../db';
import { chats, NewChat } from '../db-schemas';
import { session } from './session-manager';
import {
    docker,
    CLAUDE_CODE_IMAGE,
    CLAUDE_CODE_VERSION,
    checkImageExists,
    createContainer,
    startContainer,
    getContainerLogs,
    pullImage,
    generateContainerName,
} from './docker-manager';
import { getApiKey, getAuthMethod, getGitHubToken } from './config-manager';
import { extractOAuthCredentials, extractOAuthAccountInfo } from './credential-manager';
import { ensureContainerStatePath } from '../utils/paths';

export interface InitializeAgentOptions {
    sessionId: number;
    worktreePath: string;
    config: AgentConfig;
}

export interface InitializeAgentResult {
    containerId: string;
    containerName: string;
}

export const initializeAgent = async (
    options: InitializeAgentOptions
): Promise<InitializeAgentResult> => {
    switch (options.config.type) {
        case 'claude-code':
            return initializeClaudeCode(options);
        case 'cline':
            return initializeCline(options);
        case 'cursor':
            return initializeCursor(options);
        default:
            throw new Error(`Unsupported agent type: ${options.config.type}`);
    }
};

const initializeClaudeCode = async (
    options: InitializeAgentOptions
): Promise<InitializeAgentResult> => {
    const authMethod = getAuthMethod();

    if (authMethod === 'oauth') {
        return initializeClaudeCodeWithOAuth(options);
    } else {
        return initializeClaudeCodeWithApiKey(options);
    }
};

const buildClaudeEnv = (config: AgentConfig): Record<string, string> => {
    const env: Record<string, string> = {
        VIWO_PROMPT: config.initialPrompt,
        CLAUDE_CODE_SANDBOXED: '1',
    };

    if (config.model) {
        env.VIWO_MODEL = config.model;
    }

    const githubToken = getGitHubToken();
    if (githubToken) {
        env.GITHUB_TOKEN = githubToken;
    }

    return env;
};

const startClaudeContainer = async (options: {
    sessionId: number;
    worktreePath: string;
    config: AgentConfig;
    env: Record<string, string>;
}): Promise<InitializeAgentResult> => {
    const { sessionId, worktreePath, config, env } = options;

    const imageExists = await checkImageExists({ image: CLAUDE_CODE_IMAGE });
    if (!imageExists) {
        await pullImage({ image: CLAUDE_CODE_IMAGE });
    }

    const containerName = generateContainerName(sessionId);
    const claudeEnv = buildClaudeEnv(config);

    const statePath = await ensureContainerStatePath(sessionId);

    const containerInfo = await createContainer({
        name: containerName,
        image: CLAUDE_CODE_IMAGE,
        worktreePath,
        env: { ...env, ...claudeEnv },
        tty: true,
        openStdin: true,
        additionalBinds: [`${statePath}:/tmp/viwo-state`],
    });

    const initialChat: NewChat = {
        sessionId: sessionId.toString(),
        type: 'user',
        content: config.initialPrompt,
        createdAt: new Date().toISOString(),
    };
    db.insert(chats).values(initialChat).run();

    await startContainer({ containerId: containerInfo.id });

    session.update({
        id: sessionId,
        updates: {
            containerId: containerInfo.id,
            containerName: containerInfo.name,
            containerImage: CLAUDE_CODE_IMAGE,
            claudeCodeVersion: CLAUDE_CODE_VERSION,
            status: SessionStatus.RUNNING,
            lastActivity: new Date().toISOString(),
        },
    });

    getContainerLogs(
        {
            containerId: containerInfo.id,
            follow: true,
            stdout: true,
            stderr: true,
            tty: true,
        },
        (logContent: string) => {
            const chatEntry: NewChat = {
                sessionId: sessionId.toString(),
                type: 'assistant',
                content: logContent,
                createdAt: new Date().toISOString(),
            };
            db.insert(chats).values(chatEntry).run();

            session.update({
                id: sessionId,
                updates: {
                    lastActivity: new Date().toISOString(),
                },
            });
        }
    ).catch((error) => {
        console.error(`Log streaming error for session ${sessionId}:`, error);
        session.update({
            id: sessionId,
            updates: {
                status: SessionStatus.ERROR,
                error: `Log streaming failed: ${error.message}`,
            },
        });
    });

    return {
        containerId: containerInfo.id,
        containerName: containerInfo.name,
    };
};

const initializeClaudeCodeWithApiKey = async (
    options: InitializeAgentOptions
): Promise<InitializeAgentResult> => {
    await docker.checkDockerRunningOrThrow();

    const apiKey = getApiKey({ provider: 'anthropic' });
    if (!apiKey) {
        throw new Error(
            'Anthropic API key not configured. Please run "viwo auth" to set up your API key.'
        );
    }

    return startClaudeContainer({
        sessionId: options.sessionId,
        worktreePath: options.worktreePath,
        config: options.config,
        env: { ANTHROPIC_API_KEY: apiKey },
    });
};

const initializeClaudeCodeWithOAuth = async (
    options: InitializeAgentOptions
): Promise<InitializeAgentResult> => {
    await docker.checkDockerRunningOrThrow();

    const credentials = await extractOAuthCredentials();
    if (!credentials) {
        throw new Error(
            'No Claude subscription credentials found. ' +
                'Please log in with Claude Code first (run "claude" on your host), ' +
                'or switch to API key auth with "viwo auth".'
        );
    }

    const accountInfo = extractOAuthAccountInfo();
    const claudeConfig = JSON.stringify({
        hasCompletedOnboarding: true,
        hasCompletedProjectOnboarding: true,
        bypassPermissionsModeAccepted: true,
        ...(accountInfo ? { oauthAccount: accountInfo } : {}),
    });
    const credentialsFile = JSON.stringify({ claudeAiOauth: credentials });

    return startClaudeContainer({
        sessionId: options.sessionId,
        worktreePath: options.worktreePath,
        config: options.config,
        env: {
            VIWO_OAUTH_CREDENTIALS: credentialsFile,
            VIWO_OAUTH_CONFIG: claudeConfig,
        },
    });
};

const initializeCline = async (
    _options: InitializeAgentOptions
): Promise<InitializeAgentResult> => {
    throw new Error('Cline support not yet implemented');
};

const initializeCursor = async (
    _options: InitializeAgentOptions
): Promise<InitializeAgentResult> => {
    throw new Error('Cursor support not yet implemented');
};
