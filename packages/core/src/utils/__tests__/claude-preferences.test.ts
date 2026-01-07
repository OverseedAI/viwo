import { describe, test, expect } from 'bun:test';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
    getClaudeConfigPath,
    detectClaudePreferences,
    hasClaudePreferences,
    createClaudePreferencesTar,
    CONTAINER_CLAUDE_PATH,
} from '../claude-preferences';

describe('claude-preferences', () => {
    describe('getClaudeConfigPath', () => {
        test('returns path under home directory', () => {
            const path = getClaudeConfigPath();
            expect(path).toBe(join(homedir(), '.claude'));
        });
    });

    describe('CONTAINER_CLAUDE_PATH', () => {
        test('is set to /root/.claude', () => {
            expect(CONTAINER_CLAUDE_PATH).toBe('/root/.claude');
        });
    });

    describe('detectClaudePreferences', () => {
        test('returns array of preference items', async () => {
            const items = await detectClaudePreferences();
            expect(Array.isArray(items)).toBe(true);
            expect(items.length).toBe(4);

            const names = items.map((i) => i.name);
            expect(names).toContain('agents');
            expect(names).toContain('commands');
            expect(names).toContain('plugins');
            expect(names).toContain('settings.json');
        });

        test('each item has required properties', async () => {
            const items = await detectClaudePreferences();
            items.forEach((item) => {
                expect(item).toHaveProperty('name');
                expect(item).toHaveProperty('type');
                expect(item).toHaveProperty('path');
                expect(item).toHaveProperty('exists');
                expect(typeof item.exists).toBe('boolean');
                expect(['file', 'directory']).toContain(item.type);
            });
        });
    });

    describe('hasClaudePreferences', () => {
        test('returns boolean', async () => {
            const result = await hasClaudePreferences();
            expect(typeof result).toBe('boolean');
        });
    });

    describe('createClaudePreferencesTar', () => {
        test('returns null or readable stream', async () => {
            const hasPrefs = await hasClaudePreferences();
            const tar = await createClaudePreferencesTar();

            if (!hasPrefs) {
                expect(tar).toBeNull();
            } else {
                expect(tar).not.toBeNull();
                // If we got a stream, it should be readable
                expect(tar).toHaveProperty('read');
            }
        });
    });
});
