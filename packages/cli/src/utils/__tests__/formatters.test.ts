import { describe, it, expect } from 'bun:test';
import { formatDate } from '../formatters';

describe('formatDate', () => {
    it('should format dates with seconds', () => {
        const now = new Date();
        const past = new Date(now.getTime() - 30 * 1000); // 30 seconds ago
        expect(formatDate(past)).toBe('30s ago');
    });

    it('should format dates with minutes', () => {
        const now = new Date();
        const past = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
        expect(formatDate(past)).toBe('5m ago');
    });

    it('should format dates with hours', () => {
        const now = new Date();
        const past = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3 hours ago
        expect(formatDate(past)).toBe('3h ago');
    });

    it('should format dates with days', () => {
        const now = new Date();
        const past = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
        expect(formatDate(past)).toBe('2d ago');
    });

    it('should show "just now" for very recent dates', () => {
        const now = new Date();
        const past = new Date(now.getTime() - 5 * 1000); // 5 seconds ago
        expect(formatDate(past)).toBe('just now');
    });

    it('should handle invalid dates', () => {
        const invalidDate = new Date('invalid');
        expect(formatDate(invalidDate)).toBe('unknown');
    });

    it('should handle future dates', () => {
        const now = new Date();
        const future = new Date(now.getTime() + 1000 * 60); // 1 minute in future
        expect(formatDate(future)).toBe('just now');
    });
});
