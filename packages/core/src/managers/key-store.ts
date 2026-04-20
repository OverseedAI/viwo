import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { hostname, userInfo } from 'node:os';
import { scryptSync } from 'node:crypto';
import { joinDataPath } from '../utils/paths';

const KEYCHAIN_SERVICE = 'viwo-encryption-key';
const KEY_LENGTH = 32;
const fileFallbackPath = (): string => joinDataPath('.encryption-key');

// Legacy hostname-derived key parameters — kept for migration only.
// See issue #154; remove the legacy fallback after one or two release cycles.
const LEGACY_SALT = 'viwo-config-salt';

let cachedKey: Buffer | null = null;

/**
 * Returns the encryption key, loading it from the OS keychain (macOS) or
 * libsecret (Linux) when available, falling back to a 0600 keyfile under
 * the app data dir. Generates a fresh random key on first run.
 *
 * Cached for the lifetime of the process so we don't shell out per call.
 */
export const getEncryptionKey = (): Buffer => {
    if (cachedKey) return cachedKey;

    const existing = loadKey();
    if (existing) {
        cachedKey = existing;
        return existing;
    }

    const fresh = randomBytes(KEY_LENGTH);
    storeKey(fresh);
    cachedKey = fresh;
    return fresh;
};

/**
 * Returns the legacy hostname-derived key. Used only by the migration path
 * in config-manager so existing encrypted DB rows can be re-encrypted under
 * the new key without forcing the user to re-add every token.
 */
export const getLegacyEncryptionKey = (): Buffer => {
    const machineId = `${hostname()}-${userInfo().username}`;
    return scryptSync(machineId, LEGACY_SALT, KEY_LENGTH);
};

const loadKey = (): Buffer | null => {
    const fromOs = loadFromOsStore();
    if (fromOs) return fromOs;

    if (existsSync(fileFallbackPath())) {
        try {
            const hex = readFileSync(fileFallbackPath(), 'utf-8').trim();
            const buf = Buffer.from(hex, 'hex');
            if (buf.length === KEY_LENGTH) return buf;
        } catch {
            // fall through to "no key" — caller will generate
        }
    }
    return null;
};

const storeKey = (key: Buffer): void => {
    if (storeInOsStore(key)) return;

    // Fall back to file
    mkdirSync(dirname(fileFallbackPath()), { recursive: true });
    writeFileSync(fileFallbackPath(), key.toString('hex'), { mode: 0o600 });
    try {
        chmodSync(fileFallbackPath(), 0o600);
    } catch {
        // best effort on platforms with limited POSIX support
    }
};

const loadFromOsStore = (): Buffer | null => {
    if (process.platform === 'darwin') {
        try {
            const out = execFileSync(
                'security',
                ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-w'],
                { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
            ).trim();
            const buf = Buffer.from(out, 'hex');
            return buf.length === KEY_LENGTH ? buf : null;
        } catch {
            return null;
        }
    }

    if (process.platform === 'linux') {
        try {
            const out = execFileSync('secret-tool', ['lookup', 'service', KEYCHAIN_SERVICE], {
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
            const buf = Buffer.from(out, 'hex');
            return buf.length === KEY_LENGTH ? buf : null;
        } catch {
            return null;
        }
    }

    return null;
};

const storeInOsStore = (key: Buffer): boolean => {
    const hex = key.toString('hex');

    if (process.platform === 'darwin') {
        try {
            execFileSync(
                'security',
                [
                    'add-generic-password',
                    '-U',
                    '-s',
                    KEYCHAIN_SERVICE,
                    '-a',
                    userInfo().username,
                    '-w',
                    hex,
                ],
                { stdio: ['ignore', 'ignore', 'ignore'] }
            );
            return true;
        } catch {
            return false;
        }
    }

    if (process.platform === 'linux') {
        try {
            // secret-tool reads the secret from stdin
            execFileSync(
                'secret-tool',
                ['store', '--label=viwo encryption key', 'service', KEYCHAIN_SERVICE],
                { input: hex, stdio: ['pipe', 'ignore', 'ignore'] }
            );
            return true;
        } catch {
            return false;
        }
    }

    return false;
};

/**
 * Test-only — clear the in-memory cache so a test that re-stubs the key
 * store sees a fresh load.
 */
export const __resetKeyCacheForTests = (): void => {
    cachedKey = null;
};
