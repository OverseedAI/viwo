import { describe, test, expect } from 'bun:test';
import { generateBranchName, isValidRepository } from '../git-manager';

describe('git-manager', () => {
    describe('initializing the repository', () => {
        test('detects valid git repository', async () => {
            const isValid = await isValidRepository('/Users/hal/overseed/viwo');

            expect(isValid).toBe(true);
        });
    });

    describe('generateBranchName', () => {
        test('generates a branch name with viwo prefix when no base name provided', async () => {
            const branchName = await generateBranchName();

            expect(branchName).toMatch(/^viwo-\d{4}-\d{2}-\d{2}-[a-zA-Z0-9_-]{6}$/);
        });

        test('generates a branch name with sanitized base name', async () => {
            const branchName = await generateBranchName('Add User Authentication');

            expect(branchName).toMatch(
                /^add-user-authentication-\d{4}-\d{2}-\d{2}-[a-zA-Z0-9_-]{6}$/
            );
        });

        test('sanitizes special characters from base name', async () => {
            const branchName = await generateBranchName('Fix: Bug #123 @urgent!');

            expect(branchName).toMatch(/^fix-bug-123-urgent-\d{4}-\d{2}-\d{2}-[a-zA-Z0-9_-]{6}$/);
        });

        test('removes leading and trailing hyphens from sanitized name', async () => {
            const branchName = await generateBranchName('---test---');

            expect(branchName).toMatch(/^test-\d{4}-\d{2}-\d{2}-[a-zA-Z0-9_-]{6}$/);
        });

        test('collapses multiple consecutive hyphens', async () => {
            const branchName = await generateBranchName('test   multiple   spaces');

            expect(branchName).toMatch(/^test-multiple-spaces-\d{4}-\d{2}-\d{2}-[a-zA-Z0-9_-]{6}$/);
        });
    });
});
