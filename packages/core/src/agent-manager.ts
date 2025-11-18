import { AgentConfig, AgentType } from './schemas';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

export class AgentManager {
    async initializeAgent(worktreePath: string, config: AgentConfig): Promise<void> {
        switch (config.type) {
            case 'claude-code':
                await this.initializeClaudeCode(worktreePath, config);
                break;
            case 'cline':
                await this.initializeCline(worktreePath, config);
                break;
            case 'cursor':
                await this.initializeCursor(worktreePath, config);
                break;
            default:
                throw new Error(`Unsupported agent type: ${config.type}`);
        }
    }

    private async initializeClaudeCode(worktreePath: string, config: AgentConfig): Promise<void> {
        // Create a .claude directory with initial prompt
        const claudeDir = path.join(worktreePath, '.claude');
        if (!fs.existsSync(claudeDir)) {
            fs.mkdirSync(claudeDir, { recursive: true });
        }

        // Create initial prompt file
        const promptPath = path.join(claudeDir, 'initial-prompt.md');
        fs.writeFileSync(promptPath, config.initialPrompt);

        // Create a simple README in the worktree with instructions
        const readmePath = path.join(worktreePath, 'VIWO-README.md');
        const readmeContent = `# VIWO Session

This worktree was created by VIWO for the following task:

${config.initialPrompt}

## Getting Started

1. Run \`claude-code\` in this directory
2. The initial prompt is in \`.claude/initial-prompt.md\`
3. Make your changes and commit when ready

## Session Info

- Agent: ${config.type}
${config.model ? `- Model: ${config.model}` : ''}
- Created: ${new Date().toISOString()}
`;

        fs.writeFileSync(readmePath, readmeContent);
    }

    private async initializeCline(worktreePath: string, config: AgentConfig): Promise<void> {
        // Placeholder for Cline initialization
        // This would set up Cline-specific configuration
        throw new Error('Cline support not yet implemented');
    }

    private async initializeCursor(worktreePath: string, config: AgentConfig): Promise<void> {
        // Placeholder for Cursor initialization
        // This would set up Cursor-specific configuration
        throw new Error('Cursor support not yet implemented');
    }

    async launchAgent(worktreePath: string, agentType: AgentType): Promise<ChildProcess | null> {
        switch (agentType) {
            case 'claude-code':
                return this.launchClaudeCode(worktreePath);
            case 'cline':
                return this.launchCline(worktreePath);
            case 'cursor':
                return this.launchCursor(worktreePath);
            default:
                throw new Error(`Unsupported agent type: ${agentType}`);
        }
    }

    private launchClaudeCode(worktreePath: string): ChildProcess | null {
        // For now, we'll just prepare the environment
        // The user will need to manually run claude-code
        // In the future, we could spawn a process here
        return null;
    }

    private launchCline(worktreePath: string): ChildProcess | null {
        throw new Error('Cline support not yet implemented');
    }

    private launchCursor(worktreePath: string): ChildProcess | null {
        throw new Error('Cursor support not yet implemented');
    }
}
