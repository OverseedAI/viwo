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
export type { StateManager } from './state-manager';
export { createStateManager } from './state-manager';
export * as RepositoryManager from './repository-manager';
export * as DockerManager from './docker-manager';
export * as AgentManager from './agent-manager';
export * as PortManager from './port-manager';
