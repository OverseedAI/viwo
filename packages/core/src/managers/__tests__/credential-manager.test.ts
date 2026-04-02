import { describe, test, expect } from 'bun:test';
import { isOAuthTokenExpired } from '../credential-manager';
import type { OAuthCredentials } from '../../types';
import { OAuthCredentialsSchema, OAuthAccountInfoSchema } from '../../schemas';

describe('credential-manager', () => {
    describe('isOAuthTokenExpired', () => {
        test('returns false when token has not expired', () => {
            const credentials: OAuthCredentials = {
                accessToken: 'sk-ant-oat01-test-token',
                refreshToken: 'sk-ant-ort01-test-refresh',
                expiresAt: Date.now() + 3600000,
                scopes: ['user:inference'],
            };

            expect(isOAuthTokenExpired(credentials)).toBe(false);
        });

        test('returns true when token has expired', () => {
            const credentials: OAuthCredentials = {
                accessToken: 'sk-ant-oat01-test-token',
                refreshToken: 'sk-ant-ort01-test-refresh',
                expiresAt: Date.now() - 1000,
                scopes: ['user:inference'],
            };

            expect(isOAuthTokenExpired(credentials)).toBe(true);
        });

        test('returns true when token expires exactly now', () => {
            const credentials: OAuthCredentials = {
                accessToken: 'sk-ant-oat01-test-token',
                refreshToken: 'sk-ant-ort01-test-refresh',
                expiresAt: Date.now(),
                scopes: ['user:inference'],
            };

            expect(isOAuthTokenExpired(credentials)).toBe(true);
        });
    });

    describe('OAuthCredentialsSchema', () => {
        test('validates correct credentials', () => {
            const valid = {
                accessToken: 'sk-ant-oat01-test-token-value',
                refreshToken: 'sk-ant-ort01-test-refresh-value',
                expiresAt: 1774020540063,
                scopes: ['user:inference', 'user:profile'],
                subscriptionType: 'team',
                rateLimitTier: 'default_claude_max_5x',
            };

            const result = OAuthCredentialsSchema.safeParse(valid);
            expect(result.success).toBe(true);
        });

        test('rejects access token with wrong prefix', () => {
            const invalid = {
                accessToken: 'sk-ant-api03-wrong-prefix',
                refreshToken: 'sk-ant-ort01-test-refresh-value',
                expiresAt: 1774020540063,
                scopes: ['user:inference'],
            };

            const result = OAuthCredentialsSchema.safeParse(invalid);
            expect(result.success).toBe(false);
        });

        test('rejects refresh token with wrong prefix', () => {
            const invalid = {
                accessToken: 'sk-ant-oat01-test-token-value',
                refreshToken: 'sk-ant-api03-wrong-prefix',
                expiresAt: 1774020540063,
                scopes: ['user:inference'],
            };

            const result = OAuthCredentialsSchema.safeParse(invalid);
            expect(result.success).toBe(false);
        });
    });

    describe('OAuthAccountInfoSchema', () => {
        test('validates correct account info', () => {
            const valid = {
                accountUuid: '438de200-a809-46ad-8457-98fd640b822f',
                emailAddress: 'user@example.com',
                organizationUuid: 'f4216429-e76d-43c8-bc31-5f4dbb9d1d1d',
                displayName: 'Test User',
                organizationName: 'Test Org',
            };

            const result = OAuthAccountInfoSchema.safeParse(valid);
            expect(result.success).toBe(true);
        });

        test('accepts account info without optional fields', () => {
            const minimal = {
                accountUuid: '438de200-a809-46ad-8457-98fd640b822f',
                emailAddress: 'user@example.com',
            };

            const result = OAuthAccountInfoSchema.safeParse(minimal);
            expect(result.success).toBe(true);
        });
    });
});
