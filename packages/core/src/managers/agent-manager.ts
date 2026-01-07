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
import { getApiKey, getImportClaudePreferences } from './config-manager';
import { getClaudePreferencesBase64 } from '../utils/claude-preferences';

export interface InitializeAgentOptions {
    sessionId: number;
    worktreePath: string;
    config: AgentConfig;
    verbose?: boolean;
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
    const { sessionId, worktreePath, config, verbose } = options;
    const log = (msg: string) => verbose && console.log(`[viwo:agent] ${msg}`);

    log(`Starting Claude Code initialization for session ${sessionId}`);
    log(`Worktree path: ${worktreePath}`);

    // Check if Docker is running
    log('Checking if Docker is running...');
    await docker.checkDockerRunningOrThrow();
    log('Docker is running');

    // Get API key from configuration
    log('Getting API key...');
    const apiKey = getApiKey({ provider: 'anthropic' });

    if (!apiKey) {
        throw new Error(
            'Anthropic API key not configured. ' + 'Please run "viwo auth" to set up your API key.'
        );
    }
    log('API key retrieved');

    // Check if Claude Code image exists
    log(`Checking if Docker image exists: ${CLAUDE_CODE_IMAGE}`);
    const imageExists = await checkImageExists({ image: CLAUDE_CODE_IMAGE });

    if (!imageExists) {
        log(`Image not found, pulling: ${CLAUDE_CODE_IMAGE}`);
        await pullImage({ image: CLAUDE_CODE_IMAGE });
        log('Image pulled successfully');
    } else {
        log('Image already exists locally');
    }

    // Generate container name
    const containerName = `viwo-claude-${sessionId}-${Date.now()}`;
    log(`Generated container name: ${containerName}`);

    // Build the claude command
    // The prompt will be passed as arguments to the claude CLI
    const command = ['claude', '--dangerously-skip-permissions', '--print', '--verbose'];

    // Add model flag if specified
    if (config.model) {
        command.push('--model', config.model);
    }

    // Add the prompt as the final argument
    // Docker handles argument separation, so no manual quoting needed
    command.push(config.initialPrompt);
    log(`Command: ${command.join(' ').substring(0, 100)}...`);

    // Build environment variables
    const envVars: Record<string, string> = {
        ANTHROPIC_API_KEY: apiKey,
    };

    // Get Claude preferences as base64 if enabled
    const importPreferences = getImportClaudePreferences();
    log(`Import Claude preferences enabled: ${importPreferences}`);

    if (importPreferences) {
        try {
            log('Getting Claude preferences as base64...');
            const prefsBase64 = await getClaudePreferencesBase64();

            if (prefsBase64) {
                envVars.VIWO_CLAUDE_PREFERENCES_TAR_BASE64 = prefsBase64;
                log(`Claude preferences base64 size: ${prefsBase64.length} chars`);
            } else {
                log('No Claude preferences found to import');
            }
        } catch (error) {
            // Log warning but don't fail the session
            console.warn(
                `Failed to get Claude preferences: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    // Create the container
    log('Creating container...');
    const containerInfo = await createContainer({
        name: containerName,
        image: CLAUDE_CODE_IMAGE,
        worktreePath,
        command,
        env: envVars,
        tty: true,
        openStdin: true,
    });
    log(`Container created: ${containerInfo.id}`);

    // Log initial prompt to chats table
    log('Saving initial prompt to chats table...');
    const initialChat: NewChat = {
        sessionId: sessionId.toString(),
        type: 'user',
        content: config.initialPrompt,
        createdAt: new Date().toISOString(),
    };
    db.insert(chats).values(initialChat).run();
    log('Initial prompt saved');

    // Start the container
    log('Starting container...');
    await startContainer({ containerId: containerInfo.id });
    log('Container started');

    // Update session with container info and running status
    log('Updating session with container info...');
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
    log('Session updated');

    // Set up background log streaming to chats table
    // This runs in the background and doesn't block the function return
    log('Setting up background log streaming...');
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
                status: SessionStatus.ERROR,
                error: `Log streaming failed: ${error.message}`,
            },
        });
    });

    log('Claude Code initialization complete');
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
