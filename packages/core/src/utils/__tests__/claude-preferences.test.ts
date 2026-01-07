import { describe, test, expect } from 'bun:test';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
    getClaudeConfigPath,
    detectClaudePreferences,
    hasClaudePreferences,
    getClaudePreferencesBase64,
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
        test('is set to /home/claude/.claude', () => {
            expect(CONTAINER_CLAUDE_PATH).toBe('/home/claude/.claude');
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

    describe('getClaudePreferencesBase64', () => {
        test('returns null or base64 string', async () => {
            const hasPrefs = await hasClaudePreferences();
            const base64 = await getClaudePreferencesBase64();

            if (!hasPrefs) {
                expect(base64).toBeNull();
            } else {
                expect(base64).not.toBeNull();
                // If we got a string, it should be valid base64
                expect(typeof base64).toBe('string');
                // Base64 strings only contain these characters
                expect(base64).toMatch(/^[A-Za-z0-9+/=]+$/);
            }
        });
    });
});
