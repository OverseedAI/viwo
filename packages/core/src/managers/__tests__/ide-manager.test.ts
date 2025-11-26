import { describe, test, expect } from 'bun:test';
import { detectAvailableIDEs, isIDEAvailable, getIDEDisplayName } from '../ide-manager';

describe('ide-manager', () => {
	describe('detectAvailableIDEs', () => {
		test('returns an array of IDE info objects', async () => {
			const ides = await detectAvailableIDEs();
			expect(Array.isArray(ides)).toBe(true);
		});

		test('only returns available IDEs', async () => {
			const ides = await detectAvailableIDEs();
			for (const ide of ides) {
				expect(ide.available).toBe(true);
				expect(ide.type).toBeDefined();
				expect(ide.name).toBeDefined();
				expect(ide.command).toBeDefined();
			}
		});

		test('each IDE has required properties', async () => {
			const ides = await detectAvailableIDEs();
			for (const ide of ides) {
				expect(ide).toHaveProperty('type');
				expect(ide).toHaveProperty('name');
				expect(ide).toHaveProperty('command');
				expect(ide).toHaveProperty('available');
			}
		});
	});

	describe('isIDEAvailable', () => {
		test('returns boolean for vscode check', async () => {
			const result = await isIDEAvailable('vscode');
			expect(typeof result).toBe('boolean');
		});

		test('returns boolean for cursor check', async () => {
			const result = await isIDEAvailable('cursor');
			expect(typeof result).toBe('boolean');
		});

		test('returns false for unknown IDE type', async () => {
			const result = await isIDEAvailable('unknown-ide' as any);
			expect(result).toBe(false);
		});
	});

	describe('getIDEDisplayName', () => {
		test('returns display name for vscode', () => {
			const name = getIDEDisplayName('vscode');
			expect(name).toBe('Visual Studio Code');
		});

		test('returns display name for cursor', () => {
			const name = getIDEDisplayName('cursor');
			expect(name).toBe('Cursor');
		});

		test('returns display name for webstorm', () => {
			const name = getIDEDisplayName('webstorm');
			expect(name).toBe('WebStorm');
		});

		test('returns display name for intellij-idea', () => {
			const name = getIDEDisplayName('intellij-idea');
			expect(name).toBe('IntelliJ IDEA Ultimate');
		});

		test('returns display name for pycharm', () => {
			const name = getIDEDisplayName('pycharm');
			expect(name).toBe('PyCharm Professional');
		});

		test('returns type for unknown IDE', () => {
			const name = getIDEDisplayName('unknown-ide' as any);
			expect(name).toBe('unknown-ide');
		});
	});
});
