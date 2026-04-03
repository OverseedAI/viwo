/**
 * Session status enum
 * Represents the possible states of a VIWO session
 */
export enum SessionStatus {
    INITIALIZING = 'initializing',
    RUNNING = 'running',
    COMPLETED = 'completed',
    STOPPED = 'stopped',
    ERROR = 'error',
    CLEANED = 'cleaned',
}

/**
 * Supported IDE types
 */
export type IDEType =
    | 'vscode'
    | 'vscode-insiders'
    | 'cursor'
    | 'webstorm'
    | 'intellij-idea'
    | 'intellij-idea-ce'
    | 'pycharm'
    | 'pycharm-ce'
    | 'goland'
    | 'phpstorm'
    | 'rubymine'
    | 'clion'
    | 'datagrip'
    | 'rider';

/**
 * IDE information including availability status
 */
export interface IDEInfo {
    type: IDEType;
    name: string;
    command: string;
    available: boolean;
}

/**
 * Authentication method for Claude Code
 */
export type AuthMethod = 'api-key' | 'oauth';

/**
 * Supported Claude model types
 */
export type ModelType = 'sonnet' | 'opus' | 'haiku';

/**
 * OAuth credentials from Claude Code's credential store
 */
export interface OAuthCredentials {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scopes: string[];
    subscriptionType?: string;
    rateLimitTier?: string;
}

/**
 * OAuth account metadata from ~/.claude.json
 */
export interface OAuthAccountInfo {
    accountUuid: string;
    emailAddress: string;
    organizationUuid?: string;
    hasExtraUsageEnabled?: boolean;
    billingType?: string;
    displayName?: string;
    organizationName?: string;
}
