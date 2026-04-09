import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'path';
import { OAuthCredentialsSchema, OAuthAccountInfoSchema } from '../schemas';
import type { OAuthCredentials, OAuthAccountInfo } from '../types';

const KEYCHAIN_SERVICE = 'Claude Code-credentials';

const extractFromMacKeychain = async (): Promise<OAuthCredentials | null> => {
    const proc = Bun.spawn(
        ['security', 'find-generic-password', '-s', KEYCHAIN_SERVICE, '-w'],
        {
            stdout: 'pipe',
            stderr: 'pipe',
        }
    );

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0 || !output.trim()) {
        return null;
    }

    const parsed = JSON.parse(output.trim());
    const oauthData = parsed.claudeAiOauth;

    if (!oauthData) {
        return null;
    }

    const result = OAuthCredentialsSchema.safeParse(oauthData);
    return result.success ? result.data : null;
};

export const extractOAuthCredentials = async (): Promise<OAuthCredentials | null> => {
    const platform = process.platform;

    if (platform === 'darwin') {
        return extractFromMacKeychain();
    }

    // Linux: try reading ~/.claude/.credentials.json directly
    if (platform === 'linux') {
        try {
            const credPath = path.join(homedir(), '.claude', '.credentials.json');
            const content = readFileSync(credPath, 'utf-8');
            const parsed = JSON.parse(content);
            const oauthData = parsed.claudeAiOauth;
            if (!oauthData) return null;
            const result = OAuthCredentialsSchema.safeParse(oauthData);
            return result.success ? result.data : null;
        } catch {
            return null;
        }
    }

    return null;
};

export const extractOAuthAccountInfo = (): OAuthAccountInfo | null => {
    try {
        const configPath = path.join(homedir(), '.claude.json');
        const content = readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(content);
        const accountData = parsed.oauthAccount;

        if (!accountData) {
            return null;
        }

        const result = OAuthAccountInfoSchema.safeParse(accountData);
        return result.success ? result.data : null;
    } catch {
        return null;
    }
};

export const hasOAuthCredentials = async (): Promise<boolean> => {
    const credentials = await extractOAuthCredentials();
    return credentials !== null;
};

export const isOAuthTokenExpired = (credentials: OAuthCredentials): boolean => {
    return Date.now() >= credentials.expiresAt;
};

export interface CredentialSummary {
    emailAddress: string;
    organizationName?: string;
    subscriptionType?: string;
    rateLimitTier?: string;
    tokenExpired: boolean;
    expiresAt: Date;
}

export const getCredentialSummary = async (): Promise<CredentialSummary | null> => {
    const credentials = await extractOAuthCredentials();
    const accountInfo = extractOAuthAccountInfo();

    if (!credentials || !accountInfo) {
        return null;
    }

    return {
        emailAddress: accountInfo.emailAddress,
        organizationName: accountInfo.organizationName,
        subscriptionType: credentials.subscriptionType,
        rateLimitTier: credentials.rateLimitTier,
        tokenExpired: isOAuthTokenExpired(credentials),
        expiresAt: new Date(credentials.expiresAt),
    };
};

export const credential = {
    extractOAuthCredentials,
    extractOAuthAccountInfo,
    hasOAuthCredentials,
    isOAuthTokenExpired,
    getCredentialSummary,
};
