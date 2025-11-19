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

// Export managers for advanced usage
export * as SessionManager from './managers/session-manager';
export * as GitManager from './managers/git-manager';
export * as DockerManager from './managers/docker-manager';
export * as AgentManager from './managers/agent-manager';
export * as PortManager from './managers/port-manager';

// Export repository management
export {
    listRepositories,
    createRepository,
    deleteRepository,
    type ListRepositoryOptions,
} from './managers/repository-manager';
