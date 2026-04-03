import { AgentConfig, AgentType, SessionStatus } from '../schemas';
import type { Subprocess } from 'bun';
import { db } from '../db';
import { chats, NewChat } from '../db-schemas';
import { session } from './session-manager';
import {
    docker,
    CLAUDE_CODE_IMAGE,
    checkImageExists,
    createContainer,
    startContainer,
    getContainerLogs,
    pullImage,
} from './docker-manager';
import { getApiKey, getAuthMethod } from './config-manager';
import { extractOAuthCredentials, extractOAuthAccountInfo } from './credential-manager';

export interface InitializeAgentOptions {
    sessionId: number;
    worktreePath: string;
    config: AgentConfig;
}

export const initializeAgent = async (options: InitializeAgentOptions): Promise<void> => {
    switch (options.config.type) {
        case 'claude-code':
            await initializeClaudeCode(options);
            break;
        case 'cline':
            await initializeCline(options);
            break;
        case 'cursor':
            await initializeCursor(options);
            break;
        default:
            throw new Error(`Unsupported agent type: ${options.config.type}`);
    }
};

const initializeClaudeCode = async (options: InitializeAgentOptions): Promise<void> => {
    const authMethod = getAuthMethod();

    if (authMethod === 'oauth') {
        await initializeClaudeCodeWithOAuth(options);
    } else {
        await initializeClaudeCodeWithApiKey(options);
    }
};

const buildClaudeCommand = (config: AgentConfig): string[] => {
    const command = ['claude', '--dangerously-skip-permissions', '--print', '--verbose'];

    if (config.model) {
        command.push('--model', config.model);
    }

    command.push(config.initialPrompt);
    return command;
};

const startClaudeContainer = async (options: {
    sessionId: number;
    worktreePath: string;
    config: AgentConfig;
    env: Record<string, string>;
}): Promise<void> => {
    const { sessionId, worktreePath, config, env } = options;

    const imageExists = await checkImageExists({ image: CLAUDE_CODE_IMAGE });
    if (!imageExists) {
        await pullImage({ image: CLAUDE_CODE_IMAGE });
    }

    const containerName = `viwo-claude-${sessionId}-${Date.now()}`;
    const command = buildClaudeCommand(config);

    const containerInfo = await createContainer({
        name: containerName,
        image: CLAUDE_CODE_IMAGE,
        worktreePath,
        command,
        env,
        tty: true,
        openStdin: true,
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
};

const initializeClaudeCodeWithApiKey = async (options: InitializeAgentOptions): Promise<void> => {
    await docker.checkDockerRunningOrThrow();

    const apiKey = getApiKey({ provider: 'anthropic' });
    if (!apiKey) {
        throw new Error(
            'Anthropic API key not configured. Please run "viwo auth" to set up your API key.'
        );
    }

    await startClaudeContainer({
        sessionId: options.sessionId,
        worktreePath: options.worktreePath,
        config: options.config,
        env: { ANTHROPIC_API_KEY: apiKey },
    });
};

const initializeClaudeCodeWithOAuth = async (options: InitializeAgentOptions): Promise<void> => {
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
        hasTrustDialogAccepted: true,
        bypassPermissionsAccepted: true,
        ...(accountInfo ? { oauthAccount: accountInfo } : {}),
    });
    const credentialsFile = JSON.stringify({ claudeAiOauth: credentials });

    await startClaudeContainer({
        sessionId: options.sessionId,
        worktreePath: options.worktreePath,
        config: options.config,
        env: {
            CLAUDE_CODE_OAUTH_TOKEN: credentials.accessToken,
            VIWO_OAUTH_CREDENTIALS: credentialsFile,
            VIWO_OAUTH_CONFIG: claudeConfig,
        },
    });
};

const initializeCline = async (_options: InitializeAgentOptions): Promise<void> => {
    // Placeholder for Cline initialization
    // This would set up Cline-specific configuration
    throw new Error('Cline support not yet implemented');
};

const initializeCursor = async (_options: InitializeAgentOptions): Promise<void> => {
    // Placeholder for Cursor initialization
    // This would set up Cursor-specific configuration
    throw new Error('Cursor support not yet implemented');
};

export interface LaunchAgentOptions {
    worktreePath: string;
    agentType: AgentType;
}

export const launchAgent = async (options: LaunchAgentOptions): Promise<Subprocess | null> => {
    switch (options.agentType) {
        case 'claude-code':
            return launchClaudeCode(options.worktreePath);
        case 'cline':
            return launchCline(options.worktreePath);
        case 'cursor':
            return launchCursor(options.worktreePath);
        default:
            throw new Error(`Unsupported agent type: ${options.agentType}`);
    }
};

const launchClaudeCode = (_worktreePath: string): Subprocess | null => {
    // For now, we'll just prepare the environment
    // The user will need to manually run claude-code
    // In the future, we could spawn a process here using Bun.spawn()
    return null;
};

const launchCline = (_worktreePath: string): Subprocess | null => {
    throw new Error('Cline support not yet implemented');
};

const launchCursor = (_worktreePath: string): Subprocess | null => {
    throw new Error('Cursor support not yet implemented');
};
