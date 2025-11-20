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
} from './docker-manager';

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
    const { sessionId, worktreePath, config } = options;

    // Check if Docker is running
    await docker.checkDockerRunningOrThrow();

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
    const command = ['claude', config.initialPrompt, '--dangerously-skip-permissions'];

    // Add model flag if specified
    if (config.model) {
        command.push('--model', config.model);
    }

    // Create the container
    const containerInfo = await createContainer({
        name: containerName,
        image: CLAUDE_CODE_IMAGE,
        worktreePath,
        command,
        tty: true,
        openStdin: false,
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

    // Return immediately without waiting for container to finish
    // The container will run in the background
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
