import {
    CleanupOptions,
    CleanupOptionsSchema,
    CreateWorktreeOptions,
    CreateWorktreeOptionsSchema,
    CreateWorktreeResult,
    InitOptions,
    InitOptionsSchema,
    ListOptions,
    SessionStatus,
    StartContainerOptions,
    StartContainerOptionsSchema,
    StartContainerResult,
    ViwoConfig,
    ViwoConfigSchema,
    WorktreeSession,
} from './schemas';
import { git } from './managers/git-manager';
import {
    docker,
    readAgentState,
    syncDockerState,
    SyncDockerStateResult,
} from './managers/docker-manager';
import * as agent from './managers/agent-manager';
import {
    createSession,
    getSession,
    listSessions,
    session,
    updateSession,
} from './managers/session-manager';
import { getRepositoryById, repo } from './managers/repository-manager';
import { getContainerStatePath, joinDataPath, joinWorktreesPath } from './utils/paths';
import { initializeDatabase } from './db-init';
import { Database } from 'bun:sqlite';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { sessionToWorktreeSession } from './utils/types';
import { loadProjectConfig } from './managers/project-config-manager';
import { getPreferredModel } from './managers/config-manager';
import { expandPromptWithIssues } from './managers/github-manager';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface Viwo {
    repo: typeof repo;
    session: typeof session;
    git: typeof git;
    docker: typeof docker;

    /** Phase 1: Create git worktree, session record, env copy, and post-install hooks */
    createWorktree: (options: CreateWorktreeOptions) => Promise<CreateWorktreeResult>;

    /** Phase 2: Create and start Docker container with agent configuration */
    startContainer: (options: StartContainerOptions) => Promise<StartContainerResult>;

    /** Orchestrated flow: createWorktree → startContainer */
    start: (options: InitOptions) => Promise<WorktreeSession>;

    list: (options?: ListOptions) => Promise<WorktreeSession[]>;
    get: (sessionId: string) => Promise<WorktreeSession | null>;
    cleanup: (options: CleanupOptions) => Promise<void>;
    prune: () => Promise<void>;
    sync: () => Promise<SyncDockerStateResult>;
    migrate: (verbose?: boolean) => Promise<void>;
}

export function createViwo(config?: Partial<ViwoConfig>): Viwo {
    // Merge with defaults
    ViwoConfigSchema.parse(config || {});

    const createWorktreePhase = async (
        options: CreateWorktreeOptions
    ): Promise<CreateWorktreeResult> => {
        const validated = CreateWorktreeOptionsSchema.parse(options);

        const foundRepo = getRepositoryById({ id: validated.repoId });
        if (!foundRepo) {
            throw Error('This repository is not yet registered.');
        }

        const repoPath = foundRepo.path;
        await git.checkValidRepositoryOrThrow({ repoPath });

        const branchName = validated.branchName || (await git.generateBranchName());
        const worktreePath = joinWorktreesPath(branchName);

        const createdSession = await createSession({
            repoId: foundRepo.id,
            name: branchName,
            path: worktreePath,
            branchName,
            agent: 'claudecode',
        });

        try {
            await git.createWorktree({
                branchName,
                repoPath,
                worktreePath,
                fromBranch: foundRepo.defaultBranch ?? undefined,
            });

            if (validated.envFile) {
                await git.copyEnvFile({
                    sourceEnvPath: validated.envFile,
                    targetPath: worktreePath,
                });
            }

            const projectConfig = loadProjectConfig({ repoPath });

            if (projectConfig?.postInstall && projectConfig.postInstall.length > 0) {
                const userShell = process.env.SHELL || '/bin/sh';

                for (const command of projectConfig.postInstall) {
                    try {
                        await execAsync(command, {
                            cwd: worktreePath,
                            shell: userShell,
                            env: {
                                ...process.env,
                                VIWO_WORKTREE_PATH: worktreePath,
                            },
                        });
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        throw new Error(`Post-install command failed: ${command}\n${errorMessage}`);
                    }
                }
            }

            return {
                sessionId: createdSession.id,
                repoPath,
                branchName,
                worktreePath,
            };
        } catch (error) {
            // Roll back: remove worktree and branch if they were created
            try {
                await git.removeWorktree({ repoPath, worktreePath });
            } catch {
                // Ignore if worktree didn't get created
            }
            try {
                await git.deleteBranch({ repoPath, branchName, force: true });
            } catch {
                // Ignore if branch didn't get created
            }

            updateSession({
                id: createdSession.id,
                updates: {
                    status: SessionStatus.CLEANED,
                    error: error instanceof Error ? error.message : String(error),
                    lastActivity: new Date().toISOString(),
                },
            });
            throw error;
        }
    };

    const startContainerPhase = async (
        options: StartContainerOptions
    ): Promise<StartContainerResult> => {
        const validated = StartContainerOptionsSchema.parse(options);

        await docker.checkDockerRunningOrThrow();

        const result = await agent.initializeAgent({
            sessionId: validated.sessionId,
            worktreePath: validated.worktreePath,
            config: {
                initialPrompt: validated.prompt,
                type: validated.agent ?? 'claude-code',
                model: validated.model,
            },
        });

        return {
            containerId: result.containerId,
            containerName: result.containerName,
        };
    };

    return {
        repo,
        session,
        git,
        docker,

        createWorktree: createWorktreePhase,
        startContainer: startContainerPhase,

        /**
         * Orchestrated flow: createWorktree → startContainer
         */
        async start(options: InitOptions): Promise<WorktreeSession> {
            const validatedOptions = InitOptionsSchema.parse(options);

            // Phase 1: Create worktree
            const worktreeResult = await createWorktreePhase({
                repoId: validatedOptions.repoId,
                branchName: validatedOptions.branchName,
                envFile: validatedOptions.envFile,
            });

            const sessionId = String(worktreeResult.sessionId);
            const worktreeSession: WorktreeSession = {
                id: sessionId,
                repoPath: worktreeResult.repoPath,
                branchName: worktreeResult.branchName,
                worktreePath: worktreeResult.worktreePath,
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
                // Expand GitHub issue URLs in prompt
                const expandedPrompt = await expandPromptWithIssues(validatedOptions.prompt);

                // Phase 2: Start container
                const containerResult = await startContainerPhase({
                    sessionId: worktreeResult.sessionId,
                    worktreePath: worktreeResult.worktreePath,
                    prompt: expandedPrompt,
                    agent: validatedOptions.agent,
                    model: getPreferredModel() ?? 'sonnet',
                });

                worktreeSession.containerName = containerResult.containerName;
                worktreeSession.status = SessionStatus.RUNNING;
                worktreeSession.lastActivity = new Date();

                return worktreeSession;
            } catch (error) {
                // Roll back: remove worktree and branch created in phase 1
                try {
                    await git.removeWorktree({
                        repoPath: worktreeResult.repoPath,
                        worktreePath: worktreeResult.worktreePath,
                    });
                } catch {
                    // Ignore cleanup errors
                }
                try {
                    await git.deleteBranch({
                        repoPath: worktreeResult.repoPath,
                        branchName: worktreeResult.branchName,
                        force: true,
                    });
                } catch {
                    // Ignore cleanup errors
                }

                updateSession({
                    id: worktreeResult.sessionId,
                    updates: {
                        status: SessionStatus.CLEANED,
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

            const sessions = dbSessions
                .map(sessionToWorktreeSession)
                .filter((s): s is WorktreeSession => s !== null)
                .filter((s): s is WorktreeSession => s.status !== SessionStatus.CLEANED);

            // Enrich sessions with agent state from viwo-state.json
            await Promise.all(
                sessions.map(async (s) => {
                    const state = await readAgentState(parseInt(s.id, 10));
                    s.agentStatus = state.status;
                    if (state.timestamp) {
                        s.agentStateTimestamp = new Date(state.timestamp);
                    }
                })
            );

            return sessions;
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

            const worktreeSession = sessionToWorktreeSession(dbSession);
            if (!worktreeSession) return null;

            // Enrich with agent state
            const state = await readAgentState(id);
            worktreeSession.agentStatus = state.status;
            if (state.timestamp) {
                worktreeSession.agentStateTimestamp = new Date(state.timestamp);
            }

            return worktreeSession;
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

                // Remove host-side container state directory
                try {
                    const statePath = getContainerStatePath(id);
                    rmSync(statePath, { recursive: true, force: true });
                } catch (error) {
                    console.warn(`Failed to remove state directory for session ${id}:`, error);
                }

                // Remove worktree
                if (validatedOptions.removeWorktree) {
                    await git.removeWorktree({
                        repoPath: worktreeSession.repoPath,
                        worktreePath: worktreeSession.worktreePath,
                    });

                    // Delete the associated local branch
                    if (dbSession.branchName) {
                        try {
                            await git.deleteBranch({
                                repoPath: worktreeSession.repoPath,
                                branchName: dbSession.branchName,
                                force: true, // Use force to delete unmerged branches
                            });
                        } catch (error) {
                            console.warn(
                                `Failed to delete branch ${dbSession.branchName}:`,
                                error
                            );
                        }
                    }
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
            // TODO: implement prune logic for errored sessions
        },

        /**
         * Sync Docker container state with database sessions
         */
        async sync(): Promise<SyncDockerStateResult> {
            return syncDockerState();
        },
        async migrate(verbose = false) {
            if (verbose) {
                console.log('Running database migrations...');
            }
            const dbPath = joinDataPath('sqlite.db');
            mkdirSync(dirname(dbPath), { recursive: true });
            const sqlite = new Database(dbPath);
            initializeDatabase(sqlite);

            if (verbose) {
                console.log('Migrations complete!');
            }
        },
    };
}

// Export singleton instance
export const viwo = createViwo();
