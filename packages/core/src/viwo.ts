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
import { git } from './managers/git-manager';
import { docker } from './managers/docker-manager';
import * as agent from './managers/agent-manager';
import { createSession, session } from './managers/session-manager';
import { getRepositoryById, repo } from './managers/repository-manager';
import { joinWorktreesPath } from './utils/paths';
import { initializeDatabase } from './db-init';
import { Database } from 'bun:sqlite';

export interface Viwo {
    repo: typeof repo;
    session: typeof session;
    git: typeof git;
    docker: typeof docker;
    start: (options: InitOptions) => Promise<WorktreeSession>;
    list: (options?: ListOptions) => Promise<WorktreeSession[]>;
    get: (sessionId: string) => Promise<WorktreeSession | null>;
    cleanup: (options: CleanupOptions) => Promise<void>;
    migrate: () => Promise<void>;
}

export function createViwo(config?: Partial<ViwoConfig>): Viwo {
    // Merge with defaults
    const viwoConfig = ViwoConfigSchema.parse(config || {});

    // In-memory session storage (TODO: migrate to db-based sessions)
    const sessions = new Map<string, WorktreeSession>();

    return {
        repo,
        session,
        git,
        docker,
        /**
         * Initialize a new worktree session
         */
        async start(options: InitOptions): Promise<WorktreeSession> {
            // Validate options
            const validatedOptions = InitOptionsSchema.parse(options);

            // Validate repository
            const foundRepo = getRepositoryById({ id: validatedOptions.repoId });

            if (!foundRepo) {
                throw Error('This repository is not yet registered.');
            }

            const repoPath = foundRepo.path;
            await git.checkValidRepositoryOrThrow({ repoPath });
            await docker.checkDockerRunningOrThrow();

            const branchName = validatedOptions.branchName || (await git.generateBranchName());
            const worktreePath = joinWorktreesPath(branchName);

            // Create database session
            const createdSession = await createSession({
                repoId: foundRepo.id,
                name: branchName,
                path: worktreePath,
                branchName,
                agent: 'claudecode',
            });

            // Create WorktreeSession for in-memory tracking
            const sessionId = String(createdSession.id);
            const worktreeSession: WorktreeSession = {
                id: sessionId,
                repoPath,
                branchName,
                worktreePath,
                containers: [],
                ports: [],
                agent: {
                    type: validatedOptions.agent,
                    initialPrompt: validatedOptions.prompt,
                },
                status: 'initializing',
                createdAt: new Date(),
                lastActivity: new Date(),
            };

            try {
                // Create worktree
                await git.createWorktree({
                    branchName,
                    repoPath,
                    worktreePath,
                });

                // Copy environment file if specified
                if (validatedOptions.envFile) {
                    await git.copyEnvFile({
                        sourceEnvPath: validatedOptions.envFile,
                        targetPath: worktreePath,
                    });
                }

                // Initialize agent
                const agentResult = await agent.initializeAgent({
                    sessionId: createdSession.id,
                    worktreePath,
                    config: {
                        initialPrompt: validatedOptions.prompt,
                        type: 'claude-code',
                        model: 'sonnet',
                    },
                });

                // Store container info in the session
                if (agentResult.containerId) {
                    worktreeSession.containerId = agentResult.containerId;
                    worktreeSession.containerName = agentResult.containerName;
                }

                // Run setup commands if specified
                if (validatedOptions.setupCommands) {
                    // TODO: Execute setup commands
                    // For now, we'll just log them
                    console.log('Setup commands:', validatedOptions.setupCommands.join(', '));
                }

                // Update session status
                worktreeSession.status = 'running';
                worktreeSession.lastActivity = new Date();
                sessions.set(sessionId, worktreeSession);

                return worktreeSession;
            } catch (error) {
                // Update session with error
                worktreeSession.status = 'error';
                worktreeSession.error = error instanceof Error ? error.message : String(error);
                worktreeSession.lastActivity = new Date();
                sessions.set(sessionId, worktreeSession);

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
                                await docker.stopContainer({ containerId: container.id });
                            }
                            if (validatedOptions.removeContainers) {
                                await docker.removeContainer({ containerId: container.id });
                            }
                        } catch (error) {
                            console.warn(`Failed to cleanup container ${container.id}:`, error);
                        }
                    }
                }

                // Remove worktree
                if (validatedOptions.removeWorktree) {
                    await git.removeWorktree({
                        repoPath: session.repoPath,
                        worktreePath: session.worktreePath,
                    });
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
        async migrate() {
            console.log('Running database migrations...');
            const sqlite = new Database('sqlite.db');
            initializeDatabase(sqlite);
            console.log('Migrations complete!');
        },
    };
}

// Export singleton instance
export const viwo = createViwo();
