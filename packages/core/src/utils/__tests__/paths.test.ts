import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { expandTilde, migrateDataDir } from '../paths';
import { homedir } from 'node:os';
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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

describe('migrateDataDir', () => {
    let legacyDir: string;
    let newDir: string;

    beforeEach(() => {
        const base = join(tmpdir(), `viwo-migrate-test-${Date.now()}`);
        legacyDir = join(base, 'legacy');
        newDir = join(base, 'new');
    });

    afterEach(() => {
        // Clean up both dirs
        for (const dir of [legacyDir, newDir]) {
            if (existsSync(dir)) {
                rmSync(dir, { recursive: true, force: true });
            }
        }
    });

    it('should copy files from legacy to new directory', () => {
        mkdirSync(legacyDir, { recursive: true });
        writeFileSync(join(legacyDir, 'sqlite.db'), 'test-db-content');
        writeFileSync(join(legacyDir, 'other-file.txt'), 'other-content');

        const result = migrateDataDir(legacyDir, newDir);

        expect(result).toBe(true);
        expect(existsSync(join(newDir, 'sqlite.db'))).toBe(true);
        expect(readFileSync(join(newDir, 'sqlite.db'), 'utf-8')).toBe('test-db-content');
        expect(readFileSync(join(newDir, 'other-file.txt'), 'utf-8')).toBe('other-content');
        // Legacy files should still exist (copy, not move)
        expect(existsSync(join(legacyDir, 'sqlite.db'))).toBe(true);
    });

    it('should copy subdirectories recursively', () => {
        mkdirSync(join(legacyDir, 'worktrees', 'session-1'), { recursive: true });
        writeFileSync(join(legacyDir, 'sqlite.db'), 'db');
        writeFileSync(join(legacyDir, 'worktrees', 'session-1', 'file.txt'), 'nested');

        migrateDataDir(legacyDir, newDir);

        expect(readFileSync(join(newDir, 'worktrees', 'session-1', 'file.txt'), 'utf-8')).toBe(
            'nested'
        );
    });

    it('should skip if legacy directory does not exist', () => {
        const result = migrateDataDir(legacyDir, newDir);
        expect(result).toBe(false);
        expect(existsSync(newDir)).toBe(false);
    });

    it('should skip if legacy directory has no sqlite.db', () => {
        mkdirSync(legacyDir, { recursive: true });
        writeFileSync(join(legacyDir, 'some-file.txt'), 'data');

        const result = migrateDataDir(legacyDir, newDir);
        expect(result).toBe(false);
    });

    it('should skip if new directory already has sqlite.db', () => {
        mkdirSync(legacyDir, { recursive: true });
        writeFileSync(join(legacyDir, 'sqlite.db'), 'old-db');

        mkdirSync(newDir, { recursive: true });
        writeFileSync(join(newDir, 'sqlite.db'), 'new-db');

        const result = migrateDataDir(legacyDir, newDir);
        expect(result).toBe(false);
        // New db should be unchanged
        expect(readFileSync(join(newDir, 'sqlite.db'), 'utf-8')).toBe('new-db');
    });

    it('should not overwrite existing files in new directory', () => {
        mkdirSync(legacyDir, { recursive: true });
        writeFileSync(join(legacyDir, 'sqlite.db'), 'legacy-db');
        writeFileSync(join(legacyDir, 'config.txt'), 'legacy-config');

        mkdirSync(newDir, { recursive: true });
        writeFileSync(join(newDir, 'config.txt'), 'new-config');

        migrateDataDir(legacyDir, newDir);

        // sqlite.db should be copied
        expect(readFileSync(join(newDir, 'sqlite.db'), 'utf-8')).toBe('legacy-db');
        // existing file should not be overwritten
        expect(readFileSync(join(newDir, 'config.txt'), 'utf-8')).toBe('new-config');
    });
});
