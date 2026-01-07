/**
 * @viwo/core - Core SDK for VIWO
 *
 * This package provides the core functionality for managing
 * git worktrees, Docker containers, and AI agents.
 */

// Export main SDK
export type { Viwo } from './viwo';
export { createViwo, viwo } from './viwo';

// Export all schemas and types
export * from './schemas';
export * from './types';

// Export managers for advanced usage
export * as SessionManager from './managers/session-manager';
export * as GitManager from './managers/git-manager';
export * as DockerManager from './managers/docker-manager';
export * as AgentManager from './managers/agent-manager';
export * as PortManager from './managers/port-manager';
export * as ConfigManager from './managers/config-manager';
export * as IDEManager from './managers/ide-manager';
export * as ProjectConfigManager from './managers/project-config-manager';

// Export repository management
export {
    listRepositories,
    createRepository,
    deleteRepository,
    type ListRepositoryOptions,
    type DeleteRepositoryOptions,
} from './managers/repository-manager';

// Export path utilities
export * from './utils/paths';
export { AppPaths } from './utils/paths';

// Export Claude preferences utilities
export * from './utils/claude-preferences';
export { claudePreferences } from './utils/claude-preferences';
