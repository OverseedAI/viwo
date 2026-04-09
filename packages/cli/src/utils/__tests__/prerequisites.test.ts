import { describe, it, expect } from 'bun:test';
import { isVersionOutdated, formatReleaseNotes } from '../prerequisites';

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

describe('formatReleaseNotes', () => {
    it('should return all lines when under the limit', () => {
        const body = '- Fix bug A\n- Add feature B';
        expect(formatReleaseNotes(body)).toBe('- Fix bug A\n- Add feature B');
    });

    it('should filter out empty lines', () => {
        const body = '- Fix bug A\n\n\n- Add feature B\n';
        expect(formatReleaseNotes(body)).toBe('- Fix bug A\n- Add feature B');
    });

    it('should truncate and add ellipsis when over the limit', () => {
        const lines = Array.from({ length: 15 }, (_, i) => `- Item ${i + 1}`);
        const body = lines.join('\n');
        const result = formatReleaseNotes(body, 5);
        const resultLines = result.split('\n');
        expect(resultLines).toHaveLength(6); // 5 lines + ellipsis
        expect(resultLines[0]).toBe('- Item 1');
        expect(resultLines[4]).toBe('- Item 5');
        expect(resultLines[5]).toBe('  ...');
    });

    it('should not add ellipsis when exactly at the limit', () => {
        const lines = Array.from({ length: 3 }, (_, i) => `- Item ${i + 1}`);
        const body = lines.join('\n');
        const result = formatReleaseNotes(body, 3);
        expect(result).toBe('- Item 1\n- Item 2\n- Item 3');
    });
});
