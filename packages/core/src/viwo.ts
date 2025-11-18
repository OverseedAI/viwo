import path from 'path'
import os from 'os'
import { nanoid } from 'nanoid'
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
    PortMapping,
} from './schemas.js'
import { StateManager } from './state-manager.js'
import { RepositoryManager } from './repository-manager.js'
import { DockerManager } from './docker-manager.js'
import { AgentManager } from './agent-manager.js'
import { PortManager } from './port-manager.js'

export class Viwo {
    private stateManager: StateManager
    private dockerManager: DockerManager
    private agentManager: AgentManager
    private portManager: PortManager
    private config: ViwoConfig

    constructor(config?: Partial<ViwoConfig>) {
        // Merge with defaults
        this.config = ViwoConfigSchema.parse(config || {})

        // Resolve state directory to absolute path
        const stateDir = path.isAbsolute(this.config.stateDir)
            ? this.config.stateDir
            : path.join(os.homedir(), this.config.stateDir)

        this.stateManager = new StateManager(stateDir)
        this.dockerManager = new DockerManager()
        this.agentManager = new AgentManager()
        this.portManager = new PortManager(this.stateManager, this.config.portRange)
    }

    /**
     * Initialize a new worktree session
     */
    async init(options: InitOptions): Promise<WorktreeSession> {
        // Validate options
        const validatedOptions = InitOptionsSchema.parse(options)

        // Validate repository
        const repoManager = new RepositoryManager(validatedOptions.repoPath)
        const isValid = await repoManager.isValidRepository()

        if (!isValid) {
            throw new Error(`Invalid git repository: ${validatedOptions.repoPath}`)
        }

        // Check Docker is running
        const dockerRunning = await this.dockerManager.isDockerRunning()
        if (!dockerRunning) {
            throw new Error('Docker is not running. Please start Docker and try again.')
        }

        // Generate branch name
        const branchName =
            validatedOptions.branchName ||
            (await repoManager.generateBranchName(validatedOptions.prompt))

        // Create worktree path
        const worktreesDir = path.isAbsolute(this.config.worktreesDir)
            ? this.config.worktreesDir
            : path.join(validatedOptions.repoPath, this.config.worktreesDir)

        const worktreePath = path.join(worktreesDir, branchName)

        // Create session
        const sessionId = nanoid()
        const now = new Date()

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
        }

        // Save session to state
        this.stateManager.createSession(session)

        try {
            // Create worktree
            await repoManager.createWorktree(branchName, worktreePath)

            // Copy environment file if specified
            if (validatedOptions.envFile) {
                await repoManager.copyEnvFile(validatedOptions.envFile, worktreePath)
            }

            // Initialize agent
            await this.agentManager.initializeAgent(worktreePath, session.agent)

            // Run setup commands if specified
            if (validatedOptions.setupCommands) {
                // TODO: Execute setup commands
                // For now, we'll just log them
                console.log('Setup commands:', validatedOptions.setupCommands.join(', '))
            }

            // Update session status
            this.stateManager.updateSession(sessionId, {
                status: 'running',
                lastActivity: new Date(),
            })

            session.status = 'running'
            return session
        } catch (error) {
            // Update session with error
            this.stateManager.updateSession(sessionId, {
                status: 'error',
                error: error instanceof Error ? error.message : String(error),
                lastActivity: new Date(),
            })

            throw error
        }
    }

    /**
     * List all sessions
     */
    async list(options?: ListOptions): Promise<WorktreeSession[]> {
        const validatedOptions = options ? ListOptionsSchema.parse(options) : undefined

        return this.stateManager.listSessions(validatedOptions?.status, validatedOptions?.limit)
    }

    /**
     * Get a specific session
     */
    async get(sessionId: string): Promise<WorktreeSession | null> {
        return this.stateManager.getSession(sessionId)
    }

    /**
     * Cleanup a session
     */
    async cleanup(options: CleanupOptions): Promise<void> {
        const validatedOptions = CleanupOptionsSchema.parse(options)

        const session = this.stateManager.getSession(validatedOptions.sessionId)
        if (!session) {
            throw new Error(`Session not found: ${validatedOptions.sessionId}`)
        }

        try {
            // Stop and remove containers
            if (validatedOptions.stopContainers || validatedOptions.removeContainers) {
                for (const container of session.containers) {
                    try {
                        if (validatedOptions.stopContainers) {
                            await this.dockerManager.stopContainer(container.id)
                        }
                        if (validatedOptions.removeContainers) {
                            await this.dockerManager.removeContainer(container.id)
                        }
                    } catch (error) {
                        console.warn(`Failed to cleanup container ${container.id}:`, error)
                    }
                }
            }

            // Remove worktree
            if (validatedOptions.removeWorktree) {
                const repoManager = new RepositoryManager(session.repoPath)
                await repoManager.removeWorktree(session.worktreePath)
            }

            // Update session status
            this.stateManager.updateSession(validatedOptions.sessionId, {
                status: 'cleaned',
                lastActivity: new Date(),
            })
        } catch (error) {
            // Update session with error
            this.stateManager.updateSession(validatedOptions.sessionId, {
                status: 'error',
                error: error instanceof Error ? error.message : String(error),
                lastActivity: new Date(),
            })

            throw error
        }
    }

    /**
     * Close the Viwo instance and cleanup resources
     */
    close(): void {
        this.stateManager.close()
    }
}

// Export singleton instance
export const viwo = new Viwo()
