import { describe, it, expect } from 'bun:test';
import { expandTilde, getLegacyDataPath, getDataPath, getDefaultWorktreesPath } from '../paths';
import { homedir } from 'node:os';
import { join } from 'node:path';

describe('expandTilde', () => {
    it('should expand ~ to home directory', () => {
        const result = expandTilde('~');
        expect(result).toBe(homedir());
    });

    it('should expand ~/ to home directory with path', () => {
        const result = expandTilde('~/.config/viwo');
        expect(result).toBe(`${homedir()}/.config/viwo`);
    });

    it('should not modify absolute paths', () => {
        const result = expandTilde('/home/user/viwo');
        expect(result).toBe('/home/user/viwo');
    });

    it('should not modify relative paths without tilde', () => {
        const result = expandTilde('relative/path');
        expect(result).toBe('relative/path');
    });

    it('should not expand tilde in the middle of a path', () => {
        const result = expandTilde('/some/path/~/file');
        expect(result).toBe('/some/path/~/file');
    });
});

describe('getLegacyDataPath', () => {
    it('should return a platform-specific path', () => {
        const legacyPath = getLegacyDataPath();
        const home = homedir();

        // Should return a valid path on supported platforms
        if (process.platform === 'darwin') {
            expect(legacyPath).toBe(join(home, 'Library', 'Application Support', 'viwo'));
        } else if (process.platform === 'linux') {
            const expected = join(
                process.env.XDG_DATA_HOME || join(home, '.local', 'share'),
                'viwo'
            );
            expect(legacyPath).toBe(expected);
        } else if (process.platform === 'win32') {
            const expected = join(
                process.env.APPDATA || join(home, 'AppData', 'Roaming'),
                'viwo'
            );
            expect(legacyPath).toBe(expected);
        }
    });

    it('should return a path different from ~/.viwo', () => {
        const legacyPath = getLegacyDataPath();
        if (legacyPath) {
            expect(legacyPath).not.toBe(join(homedir(), '.viwo'));
        }
    });
});

describe('getDataPath', () => {
    it('should return a valid directory path', () => {
        const dataPath = getDataPath();
        expect(typeof dataPath).toBe('string');
        expect(dataPath.length).toBeGreaterThan(0);
    });
});

describe('getDefaultWorktreesPath', () => {
    it('should always point to ~/.viwo/worktrees', () => {
        expect(getDefaultWorktreesPath()).toBe(join(homedir(), '.viwo', 'worktrees'));
    });
});
