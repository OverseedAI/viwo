import { AgentConfig, AgentType } from '../schemas';
import type { Subprocess } from 'bun';
import path from 'path';
import { mkdir, exists } from 'node:fs/promises';

export interface InitializeAgentOptions {
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
    // Create a .claude directory with initial prompt
    const claudeDir = path.join(options.worktreePath, '.claude');
    if (!(await exists(claudeDir))) {
        await mkdir(claudeDir, { recursive: true });
    }

    // Create initial prompt file
    const promptPath = path.join(claudeDir, 'initial-prompt.md');
    await Bun.write(promptPath, options.config.initialPrompt);

    // Create a simple README in the worktree with instructions
    const readmePath = path.join(options.worktreePath, 'VIWO-README.md');
    const readmeContent = `# VIWO Session

This worktree was created by VIWO for the following task:

${options.config.initialPrompt}

## Getting Started

1. Run \`claude-code\` in this directory
2. The initial prompt is in \`.claude/initial-prompt.md\`
3. Make your changes and commit when ready

## Session Info

- Agent: ${options.config.type}
${options.config.model ? `- Model: ${options.config.model}` : ''}
- Created: ${new Date().toISOString()}
`;

    await Bun.write(readmePath, readmeContent);
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
