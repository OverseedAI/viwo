import {
    CleanupOptions,
    CleanupOptionsSchema,
    InitOptions,
    InitOptionsSchema,
    ListOptions,
    SessionStatus,
    ViwoConfig,
    ViwoConfigSchema,
    WorktreeSession,
} from './schemas';
import { git } from './managers/git-manager';
import { docker, syncDockerState, SyncDockerStateResult } from './managers/docker-manager';
import * as agent from './managers/agent-manager';
import {
    createSession,
    getSession,
    listSessions,
    session,
    updateSession,
} from './managers/session-manager';
import { getRepositoryById, repo } from './managers/repository-manager';
import { joinDataPath, joinWorktreesPath } from './utils/paths';
import { initializeDatabase } from './db-init';
import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { sessionToWorktreeSession } from './utils/types';
import { db } from './db';

export interface Viwo {
    repo: typeof repo;
    session: typeof session;
    git: typeof git;
    docker: typeof docker;
    start: (options: InitOptions) => Promise<WorktreeSession>;
    list: (options?: ListOptions) => Promise<WorktreeSession[]>;
    get: (sessionId: string) => Promise<WorktreeSession | null>;
    cleanup: (options: CleanupOptions) => Promise<void>;
    prune: () => Promise<void>;
    sync: () => Promise<SyncDockerStateResult>;
    migrate: () => Promise<void>;
}

export function createViwo(config?: Partial<ViwoConfig>): Viwo {
    // Merge with defaults
    const viwoConfig = ViwoConfigSchema.parse(config || {});

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

            // Create WorktreeSession for return value
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
                status: SessionStatus.INITIALIZING,
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
                await agent.initializeAgent({
                    sessionId: createdSession.id,
                    worktreePath,
                    config: {
                        initialPrompt: validatedOptions.prompt,
                        type: 'claude-code',
                        model: 'sonnet',
                    },
                });

                // Run setup commands if specified
                if (validatedOptions.setupCommands) {
                    // TODO: Execute setup commands
                    // For now, we'll just log them
                    console.log('Setup commands:', validatedOptions.setupCommands.join(', '));
                }

                // Update session status in database
                updateSession({
                    id: createdSession.id,
                    updates: {
                        status: SessionStatus.RUNNING,
                        lastActivity: new Date().toISOString(),
                    },
                });

                worktreeSession.status = SessionStatus.RUNNING;
                worktreeSession.lastActivity = new Date();

                return worktreeSession;
            } catch (error) {
                // Update session with error in database
                updateSession({
                    id: createdSession.id,
                    updates: {
                        status: SessionStatus.ERROR,
                        error: error instanceof Error ? error.message : String(error),
                        lastActivity: new Date().toISOString(),
                    },
                });

                worktreeSession.status = SessionStatus.ERROR;
                worktreeSession.error = error instanceof Error ? error.message : String(error);
                worktreeSession.lastActivity = new Date();

                throw error;
            }
        },

        /**
         * List all sessions
         */
        async list(options?: ListOptions): Promise<WorktreeSession[]> {
            const dbSessions = listSessions({
                status: options?.status,
                limit: options?.limit,
            });

            return dbSessions
                .map(sessionToWorktreeSession)
                .filter((s): s is WorktreeSession => s !== null)
                .filter((s): s is WorktreeSession => s.status !== SessionStatus.CLEANED);
        },

        /**
         * Get a specific session
         */
        async get(sessionId: string): Promise<WorktreeSession | null> {
            const id = parseInt(sessionId, 10);
            if (isNaN(id)) {
                return null;
            }

            const dbSession = getSession({ id });
            if (!dbSession) {
                return null;
            }

            return sessionToWorktreeSession(dbSession);
        },

        /**
         * Cleanup a session
         */
        async cleanup(options: CleanupOptions): Promise<void> {
            const validatedOptions = CleanupOptionsSchema.parse(options);

            const id = parseInt(validatedOptions.sessionId, 10);
            if (isNaN(id)) {
                throw new Error(`Invalid session ID: ${validatedOptions.sessionId}`);
            }

            const dbSession = getSession({ id });
            if (!dbSession) {
                throw new Error(`Session not found: ${validatedOptions.sessionId}`);
            }

            const worktreeSession = sessionToWorktreeSession(dbSession);
            if (!worktreeSession) {
                throw new Error(`Repository not found for session: ${validatedOptions.sessionId}`);
            }

            try {
                // Stop and remove containers
                if (validatedOptions.stopContainers || validatedOptions.removeContainers) {
                    if (dbSession.containerId) {
                        try {
                            const containerExists = await docker.containerExists({
                                containerId: dbSession.containerId,
                            });

                            if (containerExists) {
                                if (validatedOptions.stopContainers) {
                                    try {
                                        await docker.stopContainer({
                                            containerId: dbSession.containerId,
                                        });
                                    } catch {
                                        // Container might already be stopped
                                    }
                                }
                                if (validatedOptions.removeContainers) {
                                    await docker.removeContainer({
                                        containerId: dbSession.containerId,
                                    });
                                }
                            }
                        } catch (error) {
                            console.warn(
                                `Failed to cleanup container ${dbSession.containerId}:`,
                                error
                            );
                        }
                    }
                }

                // Remove worktree
                if (validatedOptions.removeWorktree) {
                    await git.removeWorktree({
                        repoPath: worktreeSession.repoPath,
                        worktreePath: worktreeSession.worktreePath,
                    });
                }

                // Update session status in database
                updateSession({
                    id,
                    updates: {
                        status: SessionStatus.CLEANED,
                        lastActivity: new Date().toISOString(),
                    },
                });
            } catch (error) {
                // Update session with error in database
                updateSession({
                    id,
                    updates: {
                        status: SessionStatus.ERROR,
                        error: error instanceof Error ? error.message : String(error),
                        lastActivity: new Date().toISOString(),
                    },
                });

                throw error;
            }
        },

        async prune() {
            const erroredSessions = viwo.session.list({ status: SessionStatus.ERROR });
        },

        /**
         * Sync Docker container state with database sessions
         */
        async sync(): Promise<SyncDockerStateResult> {
            return syncDockerState();
        },
        async migrate() {
            console.log('Running database migrations...');
            const dbPath = joinDataPath('sqlite.db');
            mkdirSync(dirname(dbPath), { recursive: true });
            const sqlite = new Database(dbPath);
            initializeDatabase(sqlite);
            console.log('Migrations complete!');
        },
    };
}

// Export singleton instance
export const viwo = createViwo();
