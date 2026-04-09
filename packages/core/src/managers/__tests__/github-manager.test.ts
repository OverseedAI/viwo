import { describe, test, expect, afterEach } from 'bun:test';
import { parseIssueUrls, resolveGitHubTokenFromEnv } from '../github-manager';

describe('github-manager', () => {
    describe('parseIssueUrls', () => {
        test('extracts single issue URL', () => {
            const result = parseIssueUrls(
                'Fix https://github.com/OverseedAI/viwo/issues/42 please'
            );
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                owner: 'OverseedAI',
                repo: 'viwo',
                number: 42,
                fullUrl: 'https://github.com/OverseedAI/viwo/issues/42',
            });
        });

        test('extracts multiple issue URLs from different repos', () => {
            const text = [
                'See https://github.com/org/repo/issues/1',
                'and https://github.com/other/lib/issues/99',
            ].join(' ');

            const result = parseIssueUrls(text);
            expect(result).toHaveLength(2);
            expect(result[0]!.owner).toBe('org');
            expect(result[0]!.number).toBe(1);
            expect(result[1]!.owner).toBe('other');
            expect(result[1]!.number).toBe(99);
        });

        test('deduplicates same URL appearing twice', () => {
            const url = 'https://github.com/org/repo/issues/5';
            const result = parseIssueUrls(`${url} and again ${url}`);
            expect(result).toHaveLength(1);
        });

        test('returns empty array when no issue URLs present', () => {
            expect(parseIssueUrls('just a regular prompt')).toEqual([]);
        });

        test('ignores PR URLs', () => {
            expect(parseIssueUrls('https://github.com/org/repo/pull/10')).toEqual([]);
        });

        test('handles URL at end of string', () => {
            const result = parseIssueUrls('fix https://github.com/a/b/issues/7');
            expect(result).toHaveLength(1);
            expect(result[0]!.number).toBe(7);
        });

        test('handles URL on its own line', () => {
            const text = 'Please implement:\nhttps://github.com/org/repo/issues/12\nThanks!';
            const result = parseIssueUrls(text);
            expect(result).toHaveLength(1);
            expect(result[0]!.number).toBe(12);
        });

        test('parses issue number as integer', () => {
            const result = parseIssueUrls('https://github.com/a/b/issues/007');
            expect(result[0]!.number).toBe(7);
        });
    });

    describe('resolveGitHubTokenFromEnv', () => {
        const originalGH = process.env.GITHUB_TOKEN;
        const originalGHAlt = process.env.GH_TOKEN;

        afterEach(() => {
            if (originalGH !== undefined) process.env.GITHUB_TOKEN = originalGH;
            else delete process.env.GITHUB_TOKEN;
            if (originalGHAlt !== undefined) process.env.GH_TOKEN = originalGHAlt;
            else delete process.env.GH_TOKEN;
        });

        test('returns GITHUB_TOKEN when set', () => {
            process.env.GITHUB_TOKEN = 'ghp_from_env';
            delete process.env.GH_TOKEN;
            expect(resolveGitHubTokenFromEnv()).toBe('ghp_from_env');
        });

        test('falls back to GH_TOKEN', () => {
            delete process.env.GITHUB_TOKEN;
            process.env.GH_TOKEN = 'ghp_alt';
            expect(resolveGitHubTokenFromEnv()).toBe('ghp_alt');
        });

        test('prefers GITHUB_TOKEN over GH_TOKEN', () => {
            process.env.GITHUB_TOKEN = 'primary';
            process.env.GH_TOKEN = 'secondary';
            expect(resolveGitHubTokenFromEnv()).toBe('primary');
        });

        test('returns null when neither set', () => {
            delete process.env.GITHUB_TOKEN;
            delete process.env.GH_TOKEN;
            expect(resolveGitHubTokenFromEnv()).toBeNull();
        });
    });
});
