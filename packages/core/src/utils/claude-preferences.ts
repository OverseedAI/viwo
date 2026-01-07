/**
 * Claude Code preferences import utility
 *
 * Handles discovering and packaging user's Claude Code configuration
 * for injection into Docker containers.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { stat, readdir, readFile } from 'node:fs/promises';
import * as tar from 'tar-stream';
import type { Readable } from 'node:stream';

// Items to copy from ~/.claude/
const CLAUDE_PREFERENCES_ITEMS = ['agents', 'commands', 'plugins', 'settings.json'] as const;

// Target path inside container (Claude Code config location)
export const CONTAINER_CLAUDE_PATH = '/root/.claude';

export interface ClaudePreferencesItem {
    name: string;
    type: 'file' | 'directory';
    path: string;
    exists: boolean;
}

/**
 * Get the Claude Code config directory path on the host
 * Handles platform differences
 */
export const getClaudeConfigPath = (): string => {
    // On all platforms, Claude Code uses ~/.claude/
    // On Windows, ~ expands to %USERPROFILE%
    return join(homedir(), '.claude');
};

/**
 * Check which Claude preferences items exist on the host
 */
export const detectClaudePreferences = async (): Promise<ClaudePreferencesItem[]> => {
    const basePath = getClaudeConfigPath();
    const results: ClaudePreferencesItem[] = [];

    for (const item of CLAUDE_PREFERENCES_ITEMS) {
        const itemPath = join(basePath, item);
        let exists = false;
        let type: 'file' | 'directory' = 'file';

        try {
            const stats = await stat(itemPath);
            exists = true;
            type = stats.isDirectory() ? 'directory' : 'file';
        } catch {
            // Item doesn't exist
        }

        results.push({
            name: item,
            type,
            path: itemPath,
            exists,
        });
    }

    return results;
};

/**
 * Check if there are any Claude preferences to import
 */
export const hasClaudePreferences = async (): Promise<boolean> => {
    const items = await detectClaudePreferences();
    return items.some((item) => item.exists);
};

/**
 * Recursively add directory contents to tar pack
 */
const addDirectoryToTar = async (pack: tar.Pack, dirPath: string, baseName: string): Promise<void> => {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const entryPath = join(dirPath, entry.name);
        const tarPath = join(baseName, entry.name);

        if (entry.isDirectory()) {
            // Add directory entry
            pack.entry({ name: tarPath + '/', type: 'directory' });
            // Recursively add contents
            await addDirectoryToTar(pack, entryPath, tarPath);
        } else if (entry.isFile()) {
            // Read file and add to tar
            const content = await readFile(entryPath);
            pack.entry({ name: tarPath, type: 'file', size: content.length }, content);
        }
        // Skip symlinks and other special files for security
    }
};

/**
 * Create a tar archive of Claude preferences for container injection
 * Returns a readable stream of the tar archive
 */
export const createClaudePreferencesTar = async (): Promise<Readable | null> => {
    const items = await detectClaudePreferences();
    const existingItems = items.filter((item) => item.exists);

    if (existingItems.length === 0) {
        return null;
    }

    const pack = tar.pack();

    for (const item of existingItems) {
        if (item.type === 'directory') {
            // Add directory entry first
            pack.entry({ name: item.name + '/', type: 'directory' });
            // Recursively add directory contents
            await addDirectoryToTar(pack, item.path, item.name);
        } else {
            // Read file and add to tar
            const content = await readFile(item.path);
            pack.entry({ name: item.name, type: 'file', size: content.length }, content);
        }
    }

    pack.finalize();
    return pack;
};

export const claudePreferences = {
    getClaudeConfigPath,
    detectClaudePreferences,
    hasClaudePreferences,
    createClaudePreferencesTar,
    CONTAINER_CLAUDE_PATH,
    CLAUDE_PREFERENCES_ITEMS,
};
