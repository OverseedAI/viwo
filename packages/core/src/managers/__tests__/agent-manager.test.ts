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
        test('throws error for unsupported Cline agent', async () => {
            const config: AgentConfig = {
                type: 'cline',
                initialPrompt: 'Test prompt',
            };

            await expect(
                initializeAgent({ sessionId: 1, worktreePath: tempDir, config })
            ).rejects.toThrow('Cline support not yet implemented');
        });

        test('throws error for unsupported Cursor agent', async () => {
            const config: AgentConfig = {
                type: 'cursor',
                initialPrompt: 'Test prompt',
            };

            await expect(
                initializeAgent({ sessionId: 1, worktreePath: tempDir, config })
            ).rejects.toThrow('Cursor support not yet implemented');
        });
    });
});
