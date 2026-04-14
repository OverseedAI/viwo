import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { assertExtendsBaseImage, buildDerivedImage } from '../image-builder';
import { CLAUDE_CODE_IMAGE } from '../docker-manager';

describe('image-builder validation', () => {
    let testDir: string;

    beforeEach(() => {
        testDir = join(tmpdir(), `viwo-image-test-${Date.now()}-${Math.random()}`);
        mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true });
    });

    test('rejects missing Dockerfile', async () => {
        await expect(
            buildDerivedImage({ dockerfilePath: 'missing.Dockerfile', repoPath: testDir })
        ).rejects.toThrow(/Dockerfile not found/);
    });

    test('rejects Dockerfile with wrong base image', async () => {
        const path = join(testDir, 'viwo.Dockerfile');
        writeFileSync(path, 'FROM ubuntu:24.04\nRUN echo hi\n');
        await expect(
            buildDerivedImage({ dockerfilePath: path, repoPath: testDir })
        ).rejects.toThrow(/must extend the viwo base image/);
    });

    test('rejects Dockerfile that does not start with FROM', async () => {
        const path = join(testDir, 'viwo.Dockerfile');
        writeFileSync(path, 'RUN echo hi\n');
        await expect(
            buildDerivedImage({ dockerfilePath: path, repoPath: testDir })
        ).rejects.toThrow(/first non-comment line must be a FROM/);
    });

    test('skips comments and blank lines when locating the FROM directive', () => {
        const contents = `# leading comment\n\n# another\nFROM ${CLAUDE_CODE_IMAGE}\nRUN echo hi\n`;
        expect(() =>
            assertExtendsBaseImage({ contents, dockerfilePath: 'fake' })
        ).not.toThrow();
    });

    test('rejects multi-stage builds whose first FROM is not the viwo base', () => {
        const contents = `FROM node:22 AS builder\nFROM ${CLAUDE_CODE_IMAGE}\n`;
        expect(() =>
            assertExtendsBaseImage({ contents, dockerfilePath: 'fake' })
        ).toThrow(/must extend the viwo base image/);
    });
});
