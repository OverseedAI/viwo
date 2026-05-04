import { beforeEach, describe, expect, test } from 'bun:test';
import { db } from '../../db';
import { configurations } from '../../db-schemas';
import { getAuthMethod, setAuthMethod } from '../config-manager';

describe('config-manager', () => {
    beforeEach(() => {
        db.delete(configurations).run();
    });

    test('returns api-key when no config row exists', () => {
        expect(getAuthMethod()).toBe('api-key');
    });

    test('returns oauth when auth method is oauth', () => {
        setAuthMethod('oauth');

        expect(getAuthMethod()).toBe('oauth');
    });

    test('returns api-key when auth method is api-key', () => {
        setAuthMethod('api-key');

        expect(getAuthMethod()).toBe('api-key');
    });

    test('returns api-key when auth method is invalid in database', () => {
        const now = new Date().toISOString();

        db.insert(configurations)
            .values({
                authMethod: 'corrupted-value',
                createdAt: now,
                updatedAt: now,
            })
            .run();

        expect(getAuthMethod()).toBe('api-key');
    });
});
