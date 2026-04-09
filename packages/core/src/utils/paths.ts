/**
 * Application paths utility
 *
 * All viwo data is stored in ~/.viwo/ on all platforms.
 */

import { join, isAbsolute } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { getWorktreesStorageLocation } from '../managers/config-manager.js';

const DATA_DIR = join(homedir(), '.viwo');

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
