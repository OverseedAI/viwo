import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { initializeAgent } from '../agent-manager';
import { AgentConfig } from '../../schemas';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('agent-manager', () => {
    let tempDir: string;

    beforeEach(() => {
        // Create a temporary directory for each test
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viwo-test-'));
    });

    afterEach(() => {
        // Clean up temporary directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('initializeAgent', () => {
        test('initializes Claude Code agent with .claude directory and files', async () => {
            const config: AgentConfig = {
                type: 'claude-code',
                initialPrompt: 'Test prompt for Claude Code',
            };

            await initializeAgent(tempDir, config);

            // Check .claude directory was created
            const claudeDir = path.join(tempDir, '.claude');
            expect(fs.existsSync(claudeDir)).toBe(true);

            // Check initial prompt file was created with correct content
            const promptPath = path.join(claudeDir, 'initial-prompt.md');
            expect(fs.existsSync(promptPath)).toBe(true);
            const promptContent = fs.readFileSync(promptPath, 'utf-8');
            expect(promptContent).toBe('Test prompt for Claude Code');

            // Check README was created
            const readmePath = path.join(tempDir, 'VIWO-README.md');
            expect(fs.existsSync(readmePath)).toBe(true);
            const readmeContent = fs.readFileSync(readmePath, 'utf-8');
            expect(readmeContent).toContain('Test prompt for Claude Code');
            expect(readmeContent).toContain('claude-code');
        });

        test('throws error for unsupported Cline agent', async () => {
            const config: AgentConfig = {
                type: 'cline',
                initialPrompt: 'Test prompt',
            };

            await expect(initializeAgent(tempDir, config)).rejects.toThrow(
                'Cline support not yet implemented'
            );
        });

        test('throws error for unsupported Cursor agent', async () => {
            const config: AgentConfig = {
                type: 'cursor',
                initialPrompt: 'Test prompt',
            };

            await expect(initializeAgent(tempDir, config)).rejects.toThrow(
                'Cursor support not yet implemented'
            );
        });
    });
});
