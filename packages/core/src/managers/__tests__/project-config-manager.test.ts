import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { loadProjectConfig, hasProjectConfig } from '../project-config-manager';
import { tmpdir } from 'os';

describe('project-config-manager', () => {
    let testDir: string;

    beforeEach(() => {
        // Create a temporary directory for each test
        testDir = join(tmpdir(), `viwo-test-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        // Clean up the temporary directory
        rmSync(testDir, { recursive: true, force: true });
    });

    describe('hasProjectConfig', () => {
        test('returns false when no config file exists', () => {
            const result = hasProjectConfig({ repoPath: testDir });
            expect(result).toBe(false);
        });

        test('returns true when viwo.yml exists', () => {
            writeFileSync(join(testDir, 'viwo.yml'), 'postInstall:\n  - echo "test"');
            const result = hasProjectConfig({ repoPath: testDir });
            expect(result).toBe(true);
        });

        test('returns true when viwo.yaml exists', () => {
            writeFileSync(join(testDir, 'viwo.yaml'), 'postInstall:\n  - echo "test"');
            const result = hasProjectConfig({ repoPath: testDir });
            expect(result).toBe(true);
        });
    });

    describe('loadProjectConfig', () => {
        test('returns null when no config file exists', () => {
            const result = loadProjectConfig({ repoPath: testDir });
            expect(result).toBeNull();
        });

        test('loads and parses viwo.yml', () => {
            writeFileSync(
                join(testDir, 'viwo.yml'),
                'postInstall:\n  - npm install\n  - npm run build'
            );
            const result = loadProjectConfig({ repoPath: testDir });
            expect(result).not.toBeNull();
            expect(result?.postInstall).toEqual(['npm install', 'npm run build']);
        });

        test('loads and parses viwo.yaml', () => {
            writeFileSync(join(testDir, 'viwo.yaml'), 'postInstall:\n  - yarn install');
            const result = loadProjectConfig({ repoPath: testDir });
            expect(result).not.toBeNull();
            expect(result?.postInstall).toEqual(['yarn install']);
        });

        test('prefers viwo.yml over viwo.yaml', () => {
            writeFileSync(join(testDir, 'viwo.yml'), 'postInstall:\n  - npm install');
            writeFileSync(join(testDir, 'viwo.yaml'), 'postInstall:\n  - yarn install');
            const result = loadProjectConfig({ repoPath: testDir });
            expect(result?.postInstall).toEqual(['npm install']);
        });

        test('returns empty config when postInstall is not specified', () => {
            writeFileSync(join(testDir, 'viwo.yml'), '');
            const result = loadProjectConfig({ repoPath: testDir });
            expect(result).toEqual({});
        });

        test('throws error for invalid YAML', () => {
            writeFileSync(join(testDir, 'viwo.yml'), 'invalid: yaml: content:');
            expect(() => loadProjectConfig({ repoPath: testDir })).toThrow();
        });

        test('throws error for invalid schema', () => {
            writeFileSync(join(testDir, 'viwo.yml'), 'postInstall: "not an array"');
            expect(() => loadProjectConfig({ repoPath: testDir })).toThrow();
        });
    });
});
