import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { db } from '../db';
import { configurations } from '../db-schemas';
import { eq } from 'drizzle-orm';
import { AuthMethodSchema } from '../schemas';
import type { AuthMethod, IDEType, ModelType } from '../types.js';
import { expandTilde } from '../utils/paths.js';
import { getEncryptionKey, getLegacyEncryptionKey } from './key-store';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

const encrypt = (plaintext: string): string => {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:ciphertext
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

const decryptWithKey = (encryptedData: string, key: Buffer): string => {
    const parts = encryptedData.split(':');

    if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
    }

    const [ivHex, authTagHex, ciphertext] = parts;

    const iv = Buffer.from(ivHex!, 'hex');
    const authTag = Buffer.from(authTagHex!, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext!, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};

/**
 * Decrypt a stored ciphertext, transparently migrating from the legacy
 * hostname-derived key (issue #154) to the OS-keychain key when needed.
 *
 * If the new key fails but the legacy key succeeds, the value is re-encrypted
 * under the new key via `persistMigrated` so subsequent reads avoid the
 * fallback path. If both keys fail (e.g. user moved machines and lost the
 * old hostname), returns null and prints a one-line hint.
 */
const decryptWithMigration = (
    encryptedData: string,
    label: string,
    persistMigrated: (newCipher: string) => void
): string | null => {
    try {
        return decryptWithKey(encryptedData, getEncryptionKey());
    } catch {
        // fall through to legacy attempt
    }

    try {
        const plain = decryptWithKey(encryptedData, getLegacyEncryptionKey());
        try {
            persistMigrated(encrypt(plain));
        } catch {
            // re-encryption persistence is best-effort; the plaintext is still
            // returned so the caller can use it for this session.
        }
        return plain;
    } catch {
        console.warn(
            `viwo: stored ${label} could not be decrypted. ` +
                `Re-add it via 'viwo config' to restore access.`
        );
        return null;
    }
};

export type ApiKeyProvider = 'anthropic';

export interface SetApiKeyOptions {
    provider: ApiKeyProvider;
    key: string;
}

export const setApiKey = async (options: SetApiKeyOptions): Promise<void> => {
    const { provider, key } = options;
    const encryptedKey = encrypt(key);
    const now = new Date().toISOString();

    // Check if configuration exists
    const existing = db.select().from(configurations).limit(1).all();

    if (existing.length > 0) {
        // Update existing
        const updates: Record<string, string> = {
            updatedAt: now,
        };

        if (provider === 'anthropic') {
            updates.anthropicApiKey = encryptedKey;
        }

        db.update(configurations).set(updates).where(eq(configurations.id, existing[0]!.id)).run();
    } else {
        // Insert new
        db.insert(configurations)
            .values({
                anthropicApiKey: provider === 'anthropic' ? encryptedKey : null,
                createdAt: now,
                updatedAt: now,
            })
            .run();
    }
};

export interface GetApiKeyOptions {
    provider: ApiKeyProvider;
}

export const getApiKey = (options: GetApiKeyOptions): string | null => {
    const { provider } = options;
    const config = db.select().from(configurations).limit(1).all();

    if (config.length === 0) {
        return null;
    }

    let encryptedKey: string | null = null;

    if (provider === 'anthropic') {
        encryptedKey = config[0]!.anthropicApiKey;
    }

    if (!encryptedKey) {
        return null;
    }

    const rowId = config[0]!.id;
    return decryptWithMigration(encryptedKey, `${provider} API key`, (newCipher) => {
        const updates: Record<string, string> = { updatedAt: new Date().toISOString() };
        if (provider === 'anthropic') updates.anthropicApiKey = newCipher;
        db.update(configurations).set(updates).where(eq(configurations.id, rowId)).run();
    });
};

export interface HasApiKeyOptions {
    provider: ApiKeyProvider;
}

export const hasApiKey = (options: HasApiKeyOptions): boolean => {
    return getApiKey(options) !== null;
};

export interface DeleteApiKeyOptions {
    provider: ApiKeyProvider;
}

export const deleteApiKey = (options: DeleteApiKeyOptions): void => {
    const { provider } = options;
    const config = db.select().from(configurations).limit(1).get();

    if (!config) {
        return;
    }

    const updates: Record<string, string | null> = {
        updatedAt: new Date().toISOString(),
    };

    if (provider === 'anthropic') {
        updates.anthropicApiKey = null;
    }

    db.update(configurations).set(updates).where(eq(configurations.id, config.id)).run();
};

export const setPreferredIDE = (type: IDEType): void => {
    const now = new Date().toISOString();
    const existing = db.select().from(configurations).limit(1).all();

    if (existing.length > 0) {
        // Update existing
        db.update(configurations)
            .set({
                preferredIde: type,
                updatedAt: now,
            })
            .where(eq(configurations.id, existing[0]!.id))
            .run();
    } else {
        // Insert new
        db.insert(configurations)
            .values({
                preferredIde: type,
                createdAt: now,
                updatedAt: now,
            })
            .run();
    }
};

export const getPreferredIDE = (): IDEType | null => {
    const config = db.select().from(configurations).limit(1).all();

    if (config.length === 0) {
        return null;
    }

    return (config[0]!.preferredIde as IDEType) || null;
};

export const deletePreferredIDE = (): void => {
    const config = db.select().from(configurations).limit(1).get();

    if (!config) {
        return;
    }

    db.update(configurations)
        .set({
            preferredIde: null,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(configurations.id, config.id))
        .run();
};

export const setWorktreesStorageLocation = (location: string): void => {
    const now = new Date().toISOString();
    // Expand tilde (~) to home directory before storing
    const expandedLocation = expandTilde(location);
    const existing = db.select().from(configurations).limit(1).all();

    if (existing.length > 0) {
        // Update existing
        db.update(configurations)
            .set({
                worktreesStorageLocation: expandedLocation,
                updatedAt: now,
            })
            .where(eq(configurations.id, existing[0]!.id))
            .run();
    } else {
        // Insert new
        db.insert(configurations)
            .values({
                worktreesStorageLocation: expandedLocation,
                createdAt: now,
                updatedAt: now,
            })
            .run();
    }
};

export const getWorktreesStorageLocation = (): string | null => {
    const config = db.select().from(configurations).limit(1).all();

    if (config.length === 0) {
        return null;
    }

    return config[0]!.worktreesStorageLocation || null;
};

// ─── GitHub Token Management ───────────────────────────────────────────────

export const setGitHubToken = (token: string): void => {
    const encryptedToken = encrypt(token);
    const now = new Date().toISOString();
    const existing = db.select().from(configurations).limit(1).all();

    if (existing.length > 0) {
        db.update(configurations)
            .set({ githubToken: encryptedToken, updatedAt: now })
            .where(eq(configurations.id, existing[0]!.id))
            .run();
    } else {
        db.insert(configurations)
            .values({ githubToken: encryptedToken, createdAt: now, updatedAt: now })
            .run();
    }
};

export const getGitHubToken = (): string | null => {
    const config = db.select().from(configurations).limit(1).all();

    if (config.length === 0) return null;

    const encryptedToken = config[0]!.githubToken;
    if (!encryptedToken) return null;

    const rowId = config[0]!.id;
    return decryptWithMigration(encryptedToken, 'GitHub token', (newCipher) => {
        db.update(configurations)
            .set({ githubToken: newCipher, updatedAt: new Date().toISOString() })
            .where(eq(configurations.id, rowId))
            .run();
    });
};

export const hasGitHubToken = (): boolean => {
    return getGitHubToken() !== null;
};

export const deleteGitHubToken = (): void => {
    const config = db.select().from(configurations).limit(1).get();
    if (!config) return;

    db.update(configurations)
        .set({ githubToken: null, updatedAt: new Date().toISOString() })
        .where(eq(configurations.id, config.id))
        .run();
};

// ─── GitLab Configuration ───────────────────────────────────────────────────

const normalizeGitLabInstanceUrl = (instanceUrl: string): string => {
    const trimmed = instanceUrl.trim();
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return withProtocol.replace(/\/+$/, '');
};

export const setGitLabToken = (token: string): void => {
    const encryptedToken = encrypt(token);
    const now = new Date().toISOString();
    const existing = db.select().from(configurations).limit(1).all();

    if (existing.length > 0) {
        db.update(configurations)
            .set({ gitlabToken: encryptedToken, updatedAt: now })
            .where(eq(configurations.id, existing[0]!.id))
            .run();
    } else {
        db.insert(configurations)
            .values({ gitlabToken: encryptedToken, createdAt: now, updatedAt: now })
            .run();
    }
};

export const getGitLabToken = (): string | null => {
    const config = db.select().from(configurations).limit(1).all();

    if (config.length === 0) return null;

    const encryptedToken = config[0]!.gitlabToken;
    if (!encryptedToken) return null;

    const rowId = config[0]!.id;
    return decryptWithMigration(encryptedToken, 'GitLab token', (newCipher) => {
        db.update(configurations)
            .set({ gitlabToken: newCipher, updatedAt: new Date().toISOString() })
            .where(eq(configurations.id, rowId))
            .run();
    });
};

export const hasGitLabToken = (): boolean => {
    return getGitLabToken() !== null;
};

export const deleteGitLabToken = (): void => {
    const config = db.select().from(configurations).limit(1).get();
    if (!config) return;

    db.update(configurations)
        .set({ gitlabToken: null, updatedAt: new Date().toISOString() })
        .where(eq(configurations.id, config.id))
        .run();
};

export const setGitLabInstanceUrl = (instanceUrl: string): void => {
    const normalizedUrl = normalizeGitLabInstanceUrl(instanceUrl);
    const now = new Date().toISOString();
    const existing = db.select().from(configurations).limit(1).all();

    if (existing.length > 0) {
        db.update(configurations)
            .set({ gitlabInstanceUrl: normalizedUrl, updatedAt: now })
            .where(eq(configurations.id, existing[0]!.id))
            .run();
    } else {
        db.insert(configurations)
            .values({ gitlabInstanceUrl: normalizedUrl, createdAt: now, updatedAt: now })
            .run();
    }
};

export const getGitLabInstanceUrl = (): string | null => {
    const config = db.select().from(configurations).limit(1).all();

    if (config.length === 0) {
        return null;
    }

    return config[0]!.gitlabInstanceUrl || null;
};

export const deleteGitLabInstanceUrl = (): void => {
    const config = db.select().from(configurations).limit(1).get();
    if (!config) return;

    db.update(configurations)
        .set({ gitlabInstanceUrl: null, updatedAt: new Date().toISOString() })
        .where(eq(configurations.id, config.id))
        .run();
};

export const deleteWorktreesStorageLocation = (): void => {
    const config = db.select().from(configurations).limit(1).get();

    if (!config) {
        return;
    }

    db.update(configurations)
        .set({
            worktreesStorageLocation: null,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(configurations.id, config.id))
        .run();
};

export const setAuthMethod = (method: AuthMethod): void => {
    const now = new Date().toISOString();
    const existing = db.select().from(configurations).limit(1).all();

    if (existing.length > 0) {
        db.update(configurations)
            .set({
                authMethod: method,
                updatedAt: now,
            })
            .where(eq(configurations.id, existing[0]!.id))
            .run();
    } else {
        db.insert(configurations)
            .values({
                authMethod: method,
                createdAt: now,
                updatedAt: now,
            })
            .run();
    }
};

export const setPreferredModel = (model: ModelType): void => {
    const now = new Date().toISOString();
    const existing = db.select().from(configurations).limit(1).all();

    if (existing.length > 0) {
        db.update(configurations)
            .set({
                preferredModel: model,
                updatedAt: now,
            })
            .where(eq(configurations.id, existing[0]!.id))
            .run();
    } else {
        db.insert(configurations)
            .values({
                preferredModel: model,
                createdAt: now,
                updatedAt: now,
            })
            .run();
    }
};

export const getPreferredModel = (): ModelType | null => {
    const config = db.select().from(configurations).limit(1).all();

    if (config.length === 0) {
        return null;
    }

    return (config[0]!.preferredModel as ModelType) || null;
};

export const deletePreferredModel = (): void => {
    const config = db.select().from(configurations).limit(1).get();

    if (!config) {
        return;
    }

    db.update(configurations)
        .set({
            preferredModel: null,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(configurations.id, config.id))
        .run();
};

export const getAuthMethod = (): AuthMethod => {
    const config = db.select().from(configurations).limit(1).all();

    if (config.length === 0) {
        return 'api-key';
    }

    const parsedAuthMethod = AuthMethodSchema.safeParse(config[0]!.authMethod);
    return parsedAuthMethod.success ? parsedAuthMethod.data : 'api-key';
};

export const isAuthConfigured = (): boolean => {
    const method = getAuthMethod();

    if (method === 'oauth') {
        return true;
    }

    return hasApiKey({ provider: 'anthropic' });
};

// Namespace export for consistency with other managers
export const config = {
    setApiKey,
    getApiKey,
    hasApiKey,
    deleteApiKey,
    setAuthMethod,
    getAuthMethod,
    isAuthConfigured,
    setPreferredIDE,
    getPreferredIDE,
    deletePreferredIDE,
    setPreferredModel,
    getPreferredModel,
    deletePreferredModel,
    setWorktreesStorageLocation,
    getWorktreesStorageLocation,
    deleteWorktreesStorageLocation,
    setGitHubToken,
    getGitHubToken,
    hasGitHubToken,
    deleteGitHubToken,
    setGitLabToken,
    getGitLabToken,
    hasGitLabToken,
    deleteGitLabToken,
    setGitLabInstanceUrl,
    getGitLabInstanceUrl,
    deleteGitLabInstanceUrl,
};
