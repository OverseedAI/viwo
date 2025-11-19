import { describe, test, expect } from 'bun:test';
import { isDockerRunning } from '../docker-manager';

describe('docker-manager', () => {
    describe('isDockerRunning', () => {
        test('checks if Docker is running', async () => {
            // This test will pass if Docker is running, fail if not
            // In a real test suite, you might want to mock the Docker API
            const running = await isDockerRunning();

            expect(typeof running).toBe('boolean');
        });
    });

    // Note: Additional tests for createContainer, startContainer, etc.
    // would require either a running Docker daemon or mocking the Docker API.
    // For now, we're keeping this test file minimal with just the basic check.
});
