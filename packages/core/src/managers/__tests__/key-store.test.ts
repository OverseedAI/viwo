import { describe, expect, test } from 'bun:test';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { getEncryptionKey, getLegacyEncryptionKey, __resetKeyCacheForTests } from '../key-store';

describe('key-store', () => {
    test('getEncryptionKey returns a 32-byte buffer', () => {
        __resetKeyCacheForTests();
        const key = getEncryptionKey();
        expect(Buffer.isBuffer(key)).toBe(true);
        expect(key.length).toBe(32);
    });

    test('getEncryptionKey is stable across calls within a process', () => {
        __resetKeyCacheForTests();
        const a = getEncryptionKey();
        const b = getEncryptionKey();
        expect(a.equals(b)).toBe(true);
    });

    test('getLegacyEncryptionKey is deterministic from hostname + username', () => {
        const a = getLegacyEncryptionKey();
        const b = getLegacyEncryptionKey();
        expect(a.equals(b)).toBe(true);
        expect(a.length).toBe(32);
    });

    test('keys produced by the new and legacy schemes differ', () => {
        __resetKeyCacheForTests();
        const newKey = getEncryptionKey();
        const legacyKey = getLegacyEncryptionKey();
        expect(newKey.equals(legacyKey)).toBe(false);
    });

    test('AES-GCM round trip with the new key works', () => {
        __resetKeyCacheForTests();
        const key = getEncryptionKey();
        const iv = randomBytes(16);
        const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
        const encrypted = Buffer.concat([cipher.update('hello', 'utf-8'), cipher.final()]);
        const tag = cipher.getAuthTag();

        const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
            'utf-8'
        );
        expect(decrypted).toBe('hello');
    });
});
