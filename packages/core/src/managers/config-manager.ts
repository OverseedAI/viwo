import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { hostname, userInfo } from 'os';
import { db } from '../db';
import { configurations } from '../db-schemas';
import { eq } from 'drizzle-orm';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT = 'viwo-config-salt';

// Derive encryption key from machine-specific data
const deriveKey = (): Buffer => {
    const machineId = `${hostname()}-${userInfo().username}`;
    return scryptSync(machineId, SALT, KEY_LENGTH);
};

const encrypt = (plaintext: string): string => {
    const key = deriveKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:ciphertext
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

const decrypt = (encryptedData: string): string => {
    const key = deriveKey();
    const parts = encryptedData.split(':');

    if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
    }

    const [ivHex, authTagHex, ciphertext] = parts;

    const iv = Buffer.from(ivHex!, 'hex');
    const authTag = Buffer.from(authTagHex!, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext!, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
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

    try {
        return decrypt(encryptedKey);
    } catch {
        return null;
    }
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

// Namespace export for consistency with other managers
export const config = {
    setApiKey,
    getApiKey,
    hasApiKey,
    deleteApiKey,
};
