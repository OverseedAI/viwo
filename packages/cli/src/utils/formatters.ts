import chalk from 'chalk';
import type { WorktreeSession } from '@viwo/core';

export function getStatusBadge(status: WorktreeSession['status']): string {
    switch (status) {
        case 'initializing':
            return chalk.yellow('⏳ initializing');
        case 'running':
            return chalk.green('✓ running');
        case 'completed':
            return chalk.blue('✓ completed');
        case 'stopped':
            return chalk.gray('■ stopped');
        case 'error':
            return chalk.red('✗ error');
        case 'cleaned':
            return chalk.gray('○ cleaned');
        default:
            return status;
    }
}

export function formatDate(date: Date): string {
    // Handle invalid dates
    if (isNaN(date.getTime())) {
        return 'unknown';
    }

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    // Handle future dates
    if (diff < 0) {
        return 'just now';
    }

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    if (seconds > 10) return `${seconds}s ago`;
    return 'just now';
}
