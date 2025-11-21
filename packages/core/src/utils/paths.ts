/**
 * Cross-platform application paths utility
 *
 * Provides standard locations for app data across all operating systems:
 * - macOS: ~/Library/Application Support/viwo
 * - Windows: %APPDATA%/viwo
 * - Linux: ~/.local/share/viwo (XDG)
 */

import envPaths from 'env-paths';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

const paths = envPaths('viwo', { suffix: '' });

/**
 * Get the app data directory path
 */
export const getDataPath = (): string => paths.data;

/**
 * Get the app config directory path
 */
export const getConfigPath = (): string => paths.config;

/**
 * Get the app cache directory path
 */
export const getCachePath = (): string => paths.cache;

/**
 * Get the app log directory path
 */
export const getLogPath = (): string => paths.log;

/**
 * Get the app temp directory path
 */
export const getTempPath = (): string => paths.temp;

/**
 * Join path segments to the app data directory
 *
 * @example
 * joinDataPath('worktrees', 'my-session')
 * // macOS: ~/Library/Application Support/viwo/worktrees/my-session
 * // Windows: %APPDATA%/viwo/worktrees/my-session
 * // Linux: ~/.local/share/viwo/worktrees/my-session
 */
export const joinDataPath = (...segments: string[]): string => {
    return join(paths.data, ...segments);
};

/**
 * Join path segments to the app config directory
 */
export const joinConfigPath = (...segments: string[]): string => {
    return join(paths.config, ...segments);
};

/**
 * Join path segments to the app cache directory
 */
export const joinCachePath = (...segments: string[]): string => {
    return join(paths.cache, ...segments);
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
 */
export const getWorktreesPath = (): string => {
    return joinDataPath('worktrees');
};

/**
 * Join path segments to the worktrees directory
 */
export const joinWorktreesPath = (...segments: string[]): string => {
    return joinDataPath('worktrees', ...segments);
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

export const AppPaths = {
    getDataPath,
    getConfigPath,
    getCachePath,
    getLogPath,
    getTempPath,
    joinDataPath,
    joinConfigPath,
    joinCachePath,
    ensureDataPath,
    getWorktreesPath,
    joinWorktreesPath,
    ensureWorktreesPath,
};
