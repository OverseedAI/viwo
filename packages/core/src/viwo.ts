import path from 'path';
import os from 'os';
import { nanoid } from 'nanoid';
import {
    InitOptions,
    InitOptionsSchema,
    ListOptions,
    ListOptionsSchema,
    CleanupOptions,
    CleanupOptionsSchema,
    WorktreeSession,
    ViwoConfig,
    ViwoConfigSchema,
} from './schemas';
import { StateManager, createStateManager } from './managers/state-manager';
import * as repo from './managers/repository-manager';
import * as docker from './managers/docker-manager';
import * as agent from './managers/agent-manager';
import * as ports from './managers/port-manager';

export interface Viwo {
    init: (options: InitOptions) => Promise<WorktreeSession>;
    list: (options?: ListOptions) => Promise<WorktreeSession[]>;
    get: (sessionId: string) => Promise<WorktreeSession | null>;
    cleanup: (options: CleanupOptions) => Promise<void>;
    close: () => void;
}

export function createViwo(config?: Partial<ViwoConfig>): Viwo {
    // Merge with defaults
    const viwoConfig = ViwoConfigSchema.parse(config || {});

    // Resolve state directory to absolute path
    const stateDir = path.isAbsolute(viwoConfig.stateDir)
        ? viwoConfig.stateDir
        : path.join(os.homedir(), viwoConfig.stateDir);

    const stateManager = createStateManager(stateDir);

    return {
        /**
         * Initialize a new worktree session
         */
        async init(options: InitOptions): Promise<WorktreeSession> {
            // Validate options
            const validatedOptions = InitOptionsSchema.parse(options);

            // Validate repository
            const isValid = await repo.isValidRepository(validatedOptions.repoPath);

            if (!isValid) {
                throw new Error(`Invalid git repository: ${validatedOptions.repoPath}`);
            }

            // Check Docker is running
            const dockerRunning = await docker.isDockerRunning();
            if (!dockerRunning) {
                throw new Error('Docker is not running. Please start Docker and try again.');
            }

            // Generate branch name
            const branchName =
                validatedOptions.branchName ||
                (await repo.generateBranchName(validatedOptions.prompt));

            // Create worktree path
            const worktreesDir = path.isAbsolute(viwoConfig.worktreesDir)
                ? viwoConfig.worktreesDir
                : path.join(validatedOptions.repoPath, viwoConfig.worktreesDir);

            const worktreePath = path.join(worktreesDir, branchName);

            // Create session
            const sessionId = nanoid();
            const now = new Date();

            const session: WorktreeSession = {
                id: sessionId,
                repoPath: validatedOptions.repoPath,
                branchName,
                worktreePath,
                containers: [],
                ports: [],
                agent: {
                    type: validatedOptions.agent,
                    initialPrompt: validatedOptions.prompt,
                },
                status: 'initializing',
                createdAt: now,
                lastActivity: now,
            };

            // Save session to state
            stateManager.createSession(session);

            try {
                // Create worktree
                await repo.createWorktree(validatedOptions.repoPath, branchName, worktreePath);

                // Copy environment file if specified
                if (validatedOptions.envFile) {
                    await repo.copyEnvFile(validatedOptions.envFile, worktreePath);
                }

                // Initialize agent
                await agent.initializeAgent(worktreePath, session.agent);

                // Run setup commands if specified
                if (validatedOptions.setupCommands) {
                    // TODO: Execute setup commands
                    // For now, we'll just log them
                    console.log('Setup commands:', validatedOptions.setupCommands.join(', '));
                }

                // Update session status
                stateManager.updateSession(sessionId, {
                    status: 'running',
                    lastActivity: new Date(),
                });

                session.status = 'running';
                return session;
            } catch (error) {
                // Update session with error
                stateManager.updateSession(sessionId, {
                    status: 'error',
                    error: error instanceof Error ? error.message : String(error),
                    lastActivity: new Date(),
                });

                throw error;
            }
        },

        /**
         * List all sessions
         */
        async list(options?: ListOptions): Promise<WorktreeSession[]> {
            const validatedOptions = options ? ListOptionsSchema.parse(options) : undefined;

            return stateManager.listSessions(validatedOptions?.status, validatedOptions?.limit);
        },

        /**
         * Get a specific session
         */
        async get(sessionId: string): Promise<WorktreeSession | null> {
            return stateManager.getSession(sessionId);
        },

        /**
         * Cleanup a session
         */
        async cleanup(options: CleanupOptions): Promise<void> {
            const validatedOptions = CleanupOptionsSchema.parse(options);

            const session = stateManager.getSession(validatedOptions.sessionId);
            if (!session) {
                throw new Error(`Session not found: ${validatedOptions.sessionId}`);
            }

            try {
                // Stop and remove containers
                if (validatedOptions.stopContainers || validatedOptions.removeContainers) {
                    for (const container of session.containers) {
                        try {
                            if (validatedOptions.stopContainers) {
                                await docker.stopContainer(container.id);
                            }
                            if (validatedOptions.removeContainers) {
                                await docker.removeContainer(container.id);
                            }
                        } catch (error) {
                            console.warn(`Failed to cleanup container ${container.id}:`, error);
                        }
                    }
                }

                // Remove worktree
                if (validatedOptions.removeWorktree) {
                    await repo.removeWorktree(session.repoPath, session.worktreePath);
                }

                // Update session status
                stateManager.updateSession(validatedOptions.sessionId, {
                    status: 'cleaned',
                    lastActivity: new Date(),
                });
            } catch (error) {
                // Update session with error
                stateManager.updateSession(validatedOptions.sessionId, {
                    status: 'error',
                    error: error instanceof Error ? error.message : String(error),
                    lastActivity: new Date(),
                });

                throw error;
            }
        },

        /**
         * Close the Viwo instance and cleanup resources
         */
        close(): void {
            stateManager.close();
        },
    };
}

// Export singleton instance
export const viwo = createViwo();
