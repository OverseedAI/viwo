import { describe, test, expect, beforeEach } from 'bun:test';
import { db } from '../../db';
import { configurations } from '../../db-schemas';
import {
    setApiKey,
    getApiKey,
    hasApiKey,
    deleteApiKey,
    setAuthMethod,
    getAuthMethod,
    setPreferredIDE,
    getPreferredIDE,
    deletePreferredIDE,
    setPreferredModel,
    getPreferredModel,
    deletePreferredModel,
    setGitHubToken,
    getGitHubToken,
    hasGitHubToken,
    deleteGitHubToken,
    setWorktreesStorageLocation,
    getWorktreesStorageLocation,
    deleteWorktreesStorageLocation,
} from '../config-manager';

describe('config-manager', () => {
    beforeEach(() => {
        db.delete(configurations).run();
    });

    // ─── API Key (encrypted) ──────────────────────────────────────────

    describe('API key', () => {
        test('set and get round-trips correctly', async () => {
            await setApiKey({ provider: 'anthropic', key: 'sk-ant-api-test123' });
            const result = getApiKey({ provider: 'anthropic' });
            expect(result).toBe('sk-ant-api-test123');
        });

        test('returns null when no key set', () => {
            expect(getApiKey({ provider: 'anthropic' })).toBeNull();
        });

        test('hasApiKey reflects presence', async () => {
            expect(hasApiKey({ provider: 'anthropic' })).toBe(false);
            await setApiKey({ provider: 'anthropic', key: 'sk-ant-api-xyz' });
            expect(hasApiKey({ provider: 'anthropic' })).toBe(true);
        });

        test('deleteApiKey removes the key', async () => {
            await setApiKey({ provider: 'anthropic', key: 'sk-ant-api-xyz' });
            deleteApiKey({ provider: 'anthropic' });
            expect(getApiKey({ provider: 'anthropic' })).toBeNull();
        });

        test('overwriting key updates in place', async () => {
            await setApiKey({ provider: 'anthropic', key: 'old-key' });
            await setApiKey({ provider: 'anthropic', key: 'new-key' });
            expect(getApiKey({ provider: 'anthropic' })).toBe('new-key');

            const rows = db.select().from(configurations).all();
            expect(rows).toHaveLength(1);
        });

        test('stores encrypted, not plaintext', async () => {
            await setApiKey({ provider: 'anthropic', key: 'sk-ant-api-secret' });
            const row = db.select().from(configurations).limit(1).get();
            expect(row!.anthropicApiKey).not.toBe('sk-ant-api-secret');
            expect(row!.anthropicApiKey).toContain(':');
        });
    });

    // ─── Auth Method ──────────────────────────────────────────────────

    describe('auth method', () => {
        test('defaults to api-key when nothing set', () => {
            expect(getAuthMethod()).toBe('api-key');
        });

        test('set and get oauth', () => {
            setAuthMethod('oauth');
            expect(getAuthMethod()).toBe('oauth');
        });

        test('switching back to api-key works', () => {
            setAuthMethod('oauth');
            setAuthMethod('api-key');
            expect(getAuthMethod()).toBe('api-key');
        });
    });

    // ─── Preferred IDE ────────────────────────────────────────────────

    describe('preferred IDE', () => {
        test('returns null by default', () => {
            expect(getPreferredIDE()).toBeNull();
        });

        test('set and get', () => {
            setPreferredIDE('vscode');
            expect(getPreferredIDE()).toBe('vscode');
        });

        test('delete resets to null', () => {
            setPreferredIDE('cursor');
            deletePreferredIDE();
            expect(getPreferredIDE()).toBeNull();
        });
    });

    // ─── Preferred Model ──────────────────────────────────────────────

    describe('preferred model', () => {
        test('returns null by default', () => {
            expect(getPreferredModel()).toBeNull();
        });

        test('set and get', () => {
            setPreferredModel('opus');
            expect(getPreferredModel()).toBe('opus');
        });

        test('delete resets to null', () => {
            setPreferredModel('haiku');
            deletePreferredModel();
            expect(getPreferredModel()).toBeNull();
        });
    });

    // ─── GitHub Token (encrypted) ─────────────────────────────────────

    describe('GitHub token', () => {
        test('set and get round-trips', () => {
            setGitHubToken('ghp_abc123');
            expect(getGitHubToken()).toBe('ghp_abc123');
        });

        test('hasGitHubToken reflects presence', () => {
            expect(hasGitHubToken()).toBe(false);
            setGitHubToken('ghp_test');
            expect(hasGitHubToken()).toBe(true);
        });

        test('delete removes token', () => {
            setGitHubToken('ghp_test');
            deleteGitHubToken();
            expect(getGitHubToken()).toBeNull();
        });
    });

    // ─── Worktrees Storage Location ───────────────────────────────────

    describe('worktrees storage location', () => {
        test('returns null by default', () => {
            expect(getWorktreesStorageLocation()).toBeNull();
        });

        test('set and get absolute path', () => {
            setWorktreesStorageLocation('/tmp/viwo-worktrees');
            expect(getWorktreesStorageLocation()).toBe('/tmp/viwo-worktrees');
        });

        test('expands tilde on set', () => {
            setWorktreesStorageLocation('~/viwo-trees');
            const result = getWorktreesStorageLocation();
            expect(result).not.toContain('~');
            expect(result).toContain('viwo-trees');
        });

        test('delete resets to null', () => {
            setWorktreesStorageLocation('/tmp/wt');
            deleteWorktreesStorageLocation();
            expect(getWorktreesStorageLocation()).toBeNull();
        });
    });

    // ─── Cross-cutting: single config row ─────────────────────────────

    describe('single config row invariant', () => {
        test('multiple settings share one config row', async () => {
            await setApiKey({ provider: 'anthropic', key: 'test-key' });
            setAuthMethod('oauth');
            setPreferredIDE('vscode');
            setPreferredModel('opus');
            setGitHubToken('ghp_token');
            setWorktreesStorageLocation('/tmp/wt');

            const rows = db.select().from(configurations).all();
            expect(rows).toHaveLength(1);

            expect(getApiKey({ provider: 'anthropic' })).toBe('test-key');
            expect(getAuthMethod()).toBe('oauth');
            expect(getPreferredIDE()).toBe('vscode');
            expect(getPreferredModel()).toBe('opus');
            expect(getGitHubToken()).toBe('ghp_token');
            expect(getWorktreesStorageLocation()).toBe('/tmp/wt');
        });
    });
});
