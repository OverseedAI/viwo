import path from 'path';
import { nanoid } from 'nanoid';
import {
    CleanupOptions,
    CleanupOptionsSchema,
    InitOptions,
    InitOptionsSchema,
    ListOptions,
    ViwoConfig,
    ViwoConfigSchema,
    WorktreeSession,
} from './schemas';
import * as git from './managers/git-manager';
import * as docker from './managers/docker-manager';
import * as agent from './managers/agent-manager';
import { repo } from './managers/repository-manager';

export interface Viwo {
    repo: typeof repo;
    init: (options: InitOptions) => Promise<WorktreeSession>;
    list: (options?: ListOptions) => Promise<WorktreeSession[]>;
    get: (sessionId: string) => Promise<WorktreeSession | null>;
    cleanup: (options: CleanupOptions) => Promise<void>;
}

export function createViwo(config?: Partial<ViwoConfig>): Viwo {
    // Merge with defaults
    const viwoConfig = ViwoConfigSchema.parse(config || {});

    // In-memory session storage (TODO: migrate to db-based sessions)
    const sessions = new Map<string, WorktreeSession>();

    return {
        repo,
        /**
         * Initialize a new worktree session
         */
        async init(options: InitOptions): Promise<WorktreeSession> {
            // Validate options
            const validatedOptions = InitOptionsSchema.parse(options);

            // Validate repository
            const isValid = await git.isValidRepository(validatedOptions.repoPath);

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
                (await git.generateBranchName(validatedOptions.prompt));

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
            sessions.set(sessionId, session);

            try {
                // Create worktree
                await git.createWorktree(validatedOptions.repoPath, branchName, worktreePath);

                // Copy environment file if specified
                if (validatedOptions.envFile) {
                    await git.copyEnvFile(validatedOptions.envFile, worktreePath);
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
                session.status = 'running';
                session.lastActivity = new Date();
                sessions.set(sessionId, session);

                return session;
            } catch (error) {
                // Update session with error
                session.status = 'error';
                session.error = error instanceof Error ? error.message : String(error);
                session.lastActivity = new Date();
                sessions.set(sessionId, session);

                throw error;
            }
        },

        /**
         * List all sessions
         */
        async list(_options?: ListOptions): Promise<WorktreeSession[]> {
            // TODO: implement filtering by status and limit
            return Array.from(sessions.values());
        },

        /**
         * Get a specific session
         */
        async get(sessionId: string): Promise<WorktreeSession | null> {
            return sessions.get(sessionId) || null;
        },

        /**
         * Cleanup a session
         */
        async cleanup(options: CleanupOptions): Promise<void> {
            const validatedOptions = CleanupOptionsSchema.parse(options);

            const session = sessions.get(validatedOptions.sessionId);
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
                    await git.removeWorktree(session.repoPath, session.worktreePath);
                }

                // Update session status
                session.status = 'cleaned';
                session.lastActivity = new Date();
                sessions.set(validatedOptions.sessionId, session);
            } catch (error) {
                // Update session with error
                session.status = 'error';
                session.error = error instanceof Error ? error.message : String(error);
                session.lastActivity = new Date();
                sessions.set(validatedOptions.sessionId, session);

                throw error;
            }
        },
    };
}

// Export singleton instance
export const viwo = createViwo();
