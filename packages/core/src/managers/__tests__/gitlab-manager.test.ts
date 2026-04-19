import { afterEach, describe, expect, test } from 'bun:test';
import {
    extractGitLabTokenFromGlabOutput,
    getGitLabApiBaseUrl,
    getGitLabInstanceBaseUrl,
    parseGitLabResourceUrls,
    resolveGitLabTokenFromEnv,
} from '../gitlab-manager';
import { deleteGitLabInstanceUrl, setGitLabInstanceUrl } from '../config-manager';

describe('gitlab-manager', () => {
    afterEach(() => {
        deleteGitLabInstanceUrl();
        delete process.env.GITLAB_TOKEN;
    });

    test('parses GitLab issue and merge request URLs on gitlab.com', () => {
        const urls = parseGitLabResourceUrls(
            [
                'Fix this issue: https://gitlab.com/group/project/-/issues/123',
                'See MR: https://gitlab.com/group/subgroup/project/-/merge_requests/456',
            ].join('\n')
        );

        expect(urls).toEqual([
            {
                instanceUrl: 'https://gitlab.com',
                projectPath: 'group/project',
                kind: 'issue',
                number: 123,
                fullUrl: 'https://gitlab.com/group/project/-/issues/123',
            },
            {
                instanceUrl: 'https://gitlab.com',
                projectPath: 'group/subgroup/project',
                kind: 'merge_request',
                number: 456,
                fullUrl: 'https://gitlab.com/group/subgroup/project/-/merge_requests/456',
            },
        ]);
    });

    test('parses configured self-hosted GitLab URLs', () => {
        setGitLabInstanceUrl('https://gitlab.company.com');

        const urls = parseGitLabResourceUrls('https://gitlab.company.com/platform/api/-/issues/42');

        expect(urls).toEqual([
            {
                instanceUrl: 'https://gitlab.company.com',
                projectPath: 'platform/api',
                kind: 'issue',
                number: 42,
                fullUrl: 'https://gitlab.company.com/platform/api/-/issues/42',
            },
        ]);
    });

    test('deduplicates repeated URLs', () => {
        const text =
            'https://gitlab.com/group/project/-/issues/123 and again https://gitlab.com/group/project/-/issues/123';

        const urls = parseGitLabResourceUrls(text);

        expect(urls).toHaveLength(1);
    });

    test('uses configured instance URL for API base URL', () => {
        setGitLabInstanceUrl('gitlab.company.com');

        expect(getGitLabInstanceBaseUrl()).toBe('https://gitlab.company.com');
        expect(getGitLabApiBaseUrl()).toBe('https://gitlab.company.com/api/v4');
    });

    test('resolves token from environment', () => {
        process.env.GITLAB_TOKEN = 'glpat-test-token';

        expect(resolveGitLabTokenFromEnv()).toBe('glpat-test-token');
    });

    test('extracts a plain token from glab output', () => {
        expect(extractGitLabTokenFromGlabOutput('glpat-test-token\n')).toBe('glpat-test-token');
    });

    test('extracts token from glab auth status output', () => {
        const output = ['gitlab.com', '  ✓ Logged in as hal', '  Token: glpat-test-token'].join(
            '\n'
        );

        expect(extractGitLabTokenFromGlabOutput(output)).toBe('glpat-test-token');
    });

    test('rejects glab help text as a token', () => {
        const output = [
            "Manage glab's authentication state.",
            '',
            'USAGE',
            '',
            '  glab auth <command> [command] [--flags]',
        ].join('\n');

        expect(extractGitLabTokenFromGlabOutput(output)).toBeNull();
    });
});
