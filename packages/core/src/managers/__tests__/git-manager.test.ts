import { describe, test, expect } from 'bun:test';
import { generateBranchName, isValidRepository, validateBranchName } from '../git-manager';

describe('git-manager', () => {
    describe('initializing the repository', () => {
        test('detects valid git repository', async () => {
            const isValid = await isValidRepository({ repoPath: process.cwd() });

            expect(isValid).toBe(true);
        });
    });

    describe('generateBranchName', () => {
        test('generates a branch name with viwo prefix when no base name provided', async () => {
            const branchName = await generateBranchName();

            expect(branchName).toMatch(/^viwo-\d{4}-\d{2}-\d{2}-[a-zA-Z0-9_-]{6}$/);
        });

        test('generates a branch name with sanitized base name', async () => {
            const branchName = await generateBranchName({ baseName: 'Add User Authentication' });

            expect(branchName).toMatch(
                /^add-user-authentication-\d{4}-\d{2}-\d{2}-[a-zA-Z0-9_-]{6}$/
            );
        });

        test('sanitizes special characters from base name', async () => {
            const branchName = await generateBranchName({ baseName: 'Fix: Bug #123 @urgent!' });

            expect(branchName).toMatch(/^fix-bug-123-urgent-\d{4}-\d{2}-\d{2}-[a-zA-Z0-9_-]{6}$/);
        });

        test('removes leading and trailing hyphens from sanitized name', async () => {
            const branchName = await generateBranchName({ baseName: '---test---' });

            expect(branchName).toMatch(/^test-\d{4}-\d{2}-\d{2}-[a-zA-Z0-9_-]{6}$/);
        });

        test('collapses multiple consecutive hyphens', async () => {
            const branchName = await generateBranchName({ baseName: 'test   multiple   spaces' });

            expect(branchName).toMatch(/^test-multiple-spaces-\d{4}-\d{2}-\d{2}-[a-zA-Z0-9_-]{6}$/);
        });
    });

    describe('validateBranchName', () => {
        test('accepts valid branch names', () => {
            expect(validateBranchName('feature/add-login')).toBeUndefined();
            expect(validateBranchName('fix-123')).toBeUndefined();
            expect(validateBranchName('release/v1.0.0')).toBeUndefined();
            expect(validateBranchName('my.branch')).toBeUndefined();
        });

        test('rejects names with spaces', () => {
            expect(validateBranchName('my branch')).toBe('Branch name cannot contain spaces');
        });

        test('rejects names with invalid characters', () => {
            expect(validateBranchName('branch~1')).toBe(
                'Branch name cannot contain ~ ^ : ? * [ or \\'
            );
            expect(validateBranchName('branch^2')).toBe(
                'Branch name cannot contain ~ ^ : ? * [ or \\'
            );
            expect(validateBranchName('branch:name')).toBe(
                'Branch name cannot contain ~ ^ : ? * [ or \\'
            );
            expect(validateBranchName('branch?')).toBe(
                'Branch name cannot contain ~ ^ : ? * [ or \\'
            );
            expect(validateBranchName('branch*')).toBe(
                'Branch name cannot contain ~ ^ : ? * [ or \\'
            );
            expect(validateBranchName('branch[0]')).toBe(
                'Branch name cannot contain ~ ^ : ? * [ or \\'
            );
            expect(validateBranchName('branch\\name')).toBe(
                'Branch name cannot contain ~ ^ : ? * [ or \\'
            );
        });

        test('rejects names with consecutive dots', () => {
            expect(validateBranchName('branch..name')).toBe(
                'Branch name cannot contain consecutive dots (..)'
            );
        });

        test('rejects names ending with a dot', () => {
            expect(validateBranchName('branch.')).toBe('Branch name cannot end with a dot');
        });

        test('rejects names ending with .lock', () => {
            expect(validateBranchName('branch.lock')).toBe('Branch name cannot end with .lock');
        });

        test('rejects names starting with a hyphen', () => {
            expect(validateBranchName('-branch')).toBe('Branch name cannot start with a hyphen');
        });

        test('rejects names containing @{', () => {
            expect(validateBranchName('branch@{0}')).toBe('Branch name cannot contain @{');
        });

        test('rejects names with slash issues', () => {
            expect(validateBranchName('/branch')).toBe(
                'Branch name cannot start/end with / or contain //'
            );
            expect(validateBranchName('branch/')).toBe(
                'Branch name cannot start/end with / or contain //'
            );
            expect(validateBranchName('branch//name')).toBe(
                'Branch name cannot start/end with / or contain //'
            );
        });
    });
});
