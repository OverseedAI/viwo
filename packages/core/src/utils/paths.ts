/**
 * Application paths utility
 *
 * All viwo data is stored in ~/.viwo/ on all platforms.
 */

import { join, isAbsolute } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { existsSync, mkdirSync, cpSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { getWorktreesStorageLocation } from '../managers/config-manager.js';

const DATA_DIR = join(homedir(), '.viwo');

/**
 * Get the legacy platform-specific data directory path.
 * Before v0.7, viwo used env-paths which stored data in:
 * - macOS: ~/Library/Application Support/viwo
 * - Linux: ~/.local/share/viwo
 * - Windows: %APPDATA%/viwo
 */
const getLegacyDataPath = (): string | null => {
    const home = homedir();
    switch (process.platform) {
        case 'darwin':
            return join(home, 'Library', 'Application Support', 'viwo');
        case 'win32':
            return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'viwo');
        case 'linux':
            return join(process.env.XDG_DATA_HOME || join(home, '.local', 'share'), 'viwo');
        default:
            return null;
    }
};

/**
 * Copy contents from a legacy data directory to a new data directory.
 * Only copies if the legacy directory has a sqlite.db and the new directory does not.
 * Files are copied (not moved) so users can verify before deleting the old directory.
 *
 * Exported for testing; prefer calling migrateLegacyDataDir() directly.
 */
export const migrateDataDir = (legacyPath: string, newPath: string): boolean => {
    // Skip if legacy directory doesn't exist
    if (!existsSync(legacyPath)) return false;

    // Skip if legacy directory has no sqlite.db (nothing meaningful to migrate)
    if (!existsSync(join(legacyPath, 'sqlite.db'))) return false;

    // Skip if new directory already has a database (migration already done or fresh install)
    if (existsSync(join(newPath, 'sqlite.db'))) return false;

    // Perform migration
    mkdirSync(newPath, { recursive: true });

    const entries = readdirSync(legacyPath, { withFileTypes: true });
    for (const entry of entries) {
        const src = join(legacyPath, entry.name);
        const dest = join(newPath, entry.name);
        // Don't overwrite anything that already exists in the new location
        if (existsSync(dest)) continue;
        cpSync(src, dest, { recursive: true });
    }

    console.log(`Migrated VIWO data from ${legacyPath} to ${newPath}`);
    console.log(`You may remove the old directory once verified: ${legacyPath}`);
    return true;
};

/**
 * Migrate data from the legacy platform-specific directory to ~/.viwo/.
 * This is a one-time, non-destructive operation called automatically on startup.
 */
export const migrateLegacyDataDir = (): void => {
    const legacyPath = getLegacyDataPath();
    if (!legacyPath || legacyPath === DATA_DIR) return;
    migrateDataDir(legacyPath, DATA_DIR);
};

/**
 * Expands tilde (~) in a path to the user's home directory
 * @param filepath Path that may contain tilde
 * @returns Path with tilde expanded
 */
export const expandTilde = (filepath: string): string => {
    if (filepath.startsWith('~/') || filepath === '~') {
        return filepath.replace(/^~/, homedir());
    }
    return filepath;
};

/**
 * Get the app data directory path (~/.viwo)
 */
export const getDataPath = (): string => DATA_DIR;

/**
 * Join path segments to the app data directory (~/.viwo)
 *
 * @example
 * joinDataPath('worktrees', 'my-session')
 * // ~/.viwo/worktrees/my-session
 */
export const joinDataPath = (...segments: string[]): string => {
    return join(DATA_DIR, ...segments);
};

/**
 * Ensure a directory exists within the app data path
 *
 * @returns The full path to the created directory
 */
export const ensureDataPath = async (...segments: string[]): Promise<string> => {
    const fullPath = joinDataPath(...segments);
    await mkdir(fullPath, { recursive: true });
    return fullPath;
};

/**
 * Get the worktrees directory path
 * Uses configured location if set, otherwise defaults to app data directory
 */
export const getWorktreesPath = (): string => {
    const configuredLocation = getWorktreesStorageLocation();

    if (configuredLocation) {
        // If configured location is absolute, use it as is
        if (isAbsolute(configuredLocation)) {
            return configuredLocation;
        }
        // Otherwise, treat it as relative to app data directory
        return joinDataPath(configuredLocation);
    }

    // Default to app data directory
    return joinDataPath('worktrees');
};

/**
 * Join path segments to the worktrees directory
 */
export const joinWorktreesPath = (...segments: string[]): string => {
    const worktreesPath = getWorktreesPath();
    return join(worktreesPath, ...segments);
};

/**
 * Ensure the worktrees directory exists and return a path within it
 *
 * @returns The full path to the created directory
 */
export const ensureWorktreesPath = async (...segments: string[]): Promise<string> => {
    const fullPath = joinWorktreesPath(...segments);
    await mkdir(fullPath, { recursive: true });
    return fullPath;
};

/**
 * Get the container state directory path for a session
 * Path: {viwo-data}/container-state/{session-id}/
 */
export const getContainerStatePath = (sessionId: number): string => {
    return joinDataPath('container-state', String(sessionId));
};

/**
 * Ensure the container state directory exists for a session
 *
 * @returns The full path to the created directory
 */
export const ensureContainerStatePath = async (sessionId: number): Promise<string> => {
    const fullPath = getContainerStatePath(sessionId);
    await mkdir(fullPath, { recursive: true });
    return fullPath;
};

export const AppPaths = {
    getDataPath,
    joinDataPath,
    ensureDataPath,
    getWorktreesPath,
    joinWorktreesPath,
    ensureWorktreesPath,
    expandTilde,
    getContainerStatePath,
    ensureContainerStatePath,
};
