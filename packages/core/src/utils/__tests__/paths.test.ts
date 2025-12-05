import { describe, it, expect } from 'bun:test';
import { expandTilde } from '../paths';
import { homedir } from 'node:os';

describe('expandTilde', () => {
	it('should expand ~ to home directory', () => {
		const result = expandTilde('~');
		expect(result).toBe(homedir());
	});

	it('should expand ~/ to home directory with path', () => {
		const result = expandTilde('~/.config/viwo');
		expect(result).toBe(`${homedir()}/.config/viwo`);
	});

	it('should not modify absolute paths', () => {
		const result = expandTilde('/home/user/viwo');
		expect(result).toBe('/home/user/viwo');
	});

	it('should not modify relative paths without tilde', () => {
		const result = expandTilde('relative/path');
		expect(result).toBe('relative/path');
	});

	it('should not expand tilde in the middle of a path', () => {
		const result = expandTilde('/some/path/~/file');
		expect(result).toBe('/some/path/~/file');
	});
});
