/**
 * @viwo/core - Core SDK for VIWO
 *
 * This package provides the core functionality for managing
 * git worktrees, Docker containers, and AI agents.
 */

// Export main SDK
export { Viwo, viwo } from './viwo';

// Export all schemas and types
export * from './schemas';

// Export managers for advanced usage
export { StateManager } from './state-manager';
export { RepositoryManager } from './repository-manager';
export { DockerManager } from './docker-manager';
export { AgentManager } from './agent-manager';
export { PortManager } from './port-manager';
