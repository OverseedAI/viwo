import { describe, it, expect } from 'bun:test';
import { isVersionOutdated } from '../prerequisites';

describe('isVersionOutdated', () => {
    it('should detect when current version is older (patch)', () => {
        expect(isVersionOutdated('0.1.5', '0.1.6')).toBe(true);
    });

    it('should detect when current version is older (minor)', () => {
        expect(isVersionOutdated('0.1.6', '0.2.0')).toBe(true);
    });

    it('should detect when current version is older (major)', () => {
        expect(isVersionOutdated('0.1.6', '1.0.0')).toBe(true);
    });

    it('should return false when versions are equal', () => {
        expect(isVersionOutdated('0.1.6', '0.1.6')).toBe(false);
    });

    it('should return false when current version is newer (patch)', () => {
        expect(isVersionOutdated('0.1.7', '0.1.6')).toBe(false);
    });

    it('should return false when current version is newer (minor)', () => {
        expect(isVersionOutdated('0.2.0', '0.1.6')).toBe(false);
    });

    it('should return false when current version is newer (major)', () => {
        expect(isVersionOutdated('1.0.0', '0.1.6')).toBe(false);
    });

    it('should handle versions with v prefix', () => {
        expect(isVersionOutdated('v0.1.5', 'v0.1.6')).toBe(true);
        expect(isVersionOutdated('v0.1.6', 'v0.1.6')).toBe(false);
    });

    it('should handle versions without patch number', () => {
        expect(isVersionOutdated('0.1', '0.2')).toBe(true);
        expect(isVersionOutdated('0.2', '0.1')).toBe(false);
    });

    it('should handle versions with only major number', () => {
        expect(isVersionOutdated('1', '2')).toBe(true);
        expect(isVersionOutdated('2', '1')).toBe(false);
    });
});
