import { describe, expect, it, test } from 'bun:test';
import pkg from '../package.json' assert { type: 'json' };

describe('viwo CLI APIs', () => {
    it('exposes version from package.json', () => {
        expect(pkg.version).toBeDefined();
    });
});

test.todo('viwo settings allows configuring default AI tool');
test.todo('viwo update upgrades the CLI to the latest version');
test.todo('viwo help displays documentation');
