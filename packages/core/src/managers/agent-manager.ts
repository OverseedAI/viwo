import { AgentConfig, AgentType } from '../schemas';
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
    waitForContainer,
    removeContainer,
} from './docker-manager';
import { getApiKey } from './config-manager';

export interface InitializeAgentOptions {
    sessionId: number;
    worktreePath: string;
    config: AgentConfig;
}

export interface InitializeAgentResult {
    containerId?: string;
    containerName?: string;
}

export const initializeAgent = async (options: InitializeAgentOptions): Promise<InitializeAgentResult> => {
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

const initializeClaudeCode = async (options: InitializeAgentOptions): Promise<InitializeAgentResult> => {
    const { sessionId, worktreePath, config } = options;

    // Check if Docker is running
    await docker.checkDockerRunningOrThrow();

    // Get API key from configuration
    const apiKey = getApiKey({ provider: 'anthropic' });

    if (!apiKey) {
        throw new Error(
            'Anthropic API key not configured. ' + 'Please run "viwo auth" to set up your API key.'
        );
    }

    // Check if Claude Code image exists
    const imageExists = await checkImageExists({ image: CLAUDE_CODE_IMAGE });

    if (!imageExists) {
        throw new Error(
            `Claude Code Docker image '${CLAUDE_CODE_IMAGE}' not found. ` +
                `Please build the image first or ensure it's available locally.`
        );
    }

    // Generate container name
    const containerName = `viwo-claude-${sessionId}-${Date.now()}`;

    // Build the claude command
    // The prompt will be passed as arguments to the claude CLI
    const command = ['claude', '--dangerously-skip-permissions', '-p'];

    // Add model flag if specified
    if (config.model) {
        command.push('--model', config.model);
    }

    command.push(`"${config.initialPrompt}"`);

    // Create the container
    const containerInfo = await createContainer({
        name: containerName,
        image: CLAUDE_CODE_IMAGE,
        worktreePath,
        command,
        env: {
            ANTHROPIC_API_KEY: apiKey,
        },
        tty: true,
        openStdin: true,
    });

    // Log initial prompt to chats table
    const initialChat: NewChat = {
        sessionId: sessionId.toString(),
        type: 'user',
        content: config.initialPrompt,
        createdAt: new Date().toISOString(),
    };
    db.insert(chats).values(initialChat).run();

    // Start the container
    await startContainer({ containerId: containerInfo.id });

    // Update session with container info and running status
    session.update({
        id: sessionId,
        updates: {
            containerId: containerInfo.id,
            containerName: containerInfo.name,
            containerImage: CLAUDE_CODE_IMAGE,
            status: 'running',
            lastActivity: new Date().toISOString(),
        },
    });

    // Set up background log streaming to chats table
    // This runs in the background and doesn't block the function return
    getContainerLogs(
        {
            containerId: containerInfo.id,
            follow: true,
            stdout: true,
            stderr: true,
        },
        (logContent: string) => {
            // Insert each log entry as an assistant message in the chats table
            const chatEntry: NewChat = {
                sessionId: sessionId.toString(),
                type: 'assistant',
                content: logContent,
                createdAt: new Date().toISOString(),
            };
            db.insert(chats).values(chatEntry).run();

            // Update last activity timestamp
            session.update({
                id: sessionId,
                updates: {
                    lastActivity: new Date().toISOString(),
                },
            });
        }
    ).catch((error) => {
        // Log streaming error - update session with error status
        console.error(`Log streaming error for session ${sessionId}:`, error);
        session.update({
            id: sessionId,
            updates: {
                status: 'error',
                error: `Log streaming failed: ${error.message}`,
            },
        });
    });

    // Monitor container completion and clean up automatically
    // This runs in the background and doesn't block the function return
    monitorContainerCompletion(sessionId, containerInfo.id);

    // Return container info for the caller to use
    return {
        containerId: containerInfo.id,
        containerName: containerInfo.name,
    };
};

/**
 * Monitor container completion and automatically clean up when it exits
 */
const monitorContainerCompletion = async (
    sessionId: number,
    containerId: string
): Promise<void> => {
    try {
        // Wait for container to complete
        const result = await waitForContainer({ containerId });

        // Determine final status based on exit code
        const finalStatus = result.statusCode === 0 ? 'completed' : 'error';
        const errorMessage = result.statusCode !== 0 ? `Container exited with code ${result.statusCode}` : undefined;

        // Update session status
        session.update({
            id: sessionId,
            updates: {
                status: finalStatus,
                error: errorMessage,
                lastActivity: new Date().toISOString(),
            },
        });

        // Remove the container
        await removeContainer({ containerId });

        console.log(`Container ${containerId} for session ${sessionId} has been cleaned up`);
    } catch (error) {
        console.error(`Failed to monitor/cleanup container ${containerId}:`, error);
        // Update session with error but don't throw - this is a background operation
        session.update({
            id: sessionId,
            updates: {
                status: 'error',
                error: `Container monitoring failed: ${error instanceof Error ? error.message : String(error)}`,
                lastActivity: new Date().toISOString(),
            },
        });
    }
};

const initializeCline = async (_options: InitializeAgentOptions): Promise<InitializeAgentResult> => {
    // Placeholder for Cline initialization
    // This would set up Cline-specific configuration
    throw new Error('Cline support not yet implemented');
};

const initializeCursor = async (_options: InitializeAgentOptions): Promise<InitializeAgentResult> => {
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
