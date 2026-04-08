import { z } from 'zod';
import { SessionStatus } from './types';

/**
 * Agent configuration schemas
 */
export const AgentTypeSchema = z.enum(['claude-code', 'cline', 'cursor']);
export type AgentType = z.infer<typeof AgentTypeSchema>;

export const AgentConfigSchema = z.object({
    type: AgentTypeSchema,
    initialPrompt: z.string().min(1),
    model: z.string().optional(),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Port mapping schemas
 */
export const PortMappingSchema = z.object({
    container: z.number().int().min(1).max(65535),
    host: z.number().int().min(1).max(65535),
    protocol: z.enum(['tcp', 'udp']).default('tcp'),
});
export type PortMapping = z.infer<typeof PortMappingSchema>;

/**
 * Container configuration schemas
 */
export const ContainerInfoSchema = z.object({
    id: z.string(),
    name: z.string(),
    image: z.string(),
    status: z.enum(['created', 'running', 'stopped', 'exited', 'error']),
    ports: z.array(PortMappingSchema),
    createdAt: z.date(),
});
export type ContainerInfo = z.infer<typeof ContainerInfoSchema>;

/**
 * Session status schemas
 */
export const SessionStatusSchema = z.enum([
    SessionStatus.INITIALIZING,
    SessionStatus.RUNNING,
    SessionStatus.COMPLETED,
    SessionStatus.STOPPED,
    SessionStatus.ERROR,
    SessionStatus.CLEANED,
]);

// Re-export SessionStatus for convenience
export { SessionStatus };

/**
 * Worktree session schemas
 */
export const AgentStatusSchema = z.enum(['working', 'awaiting_input', 'exited', 'unknown']);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const WorktreeSessionSchema = z.object({
    id: z.string(),
    repoPath: z.string(),
    branchName: z.string(),
    worktreePath: z.string(),
    containers: z.array(ContainerInfoSchema),
    ports: z.array(PortMappingSchema),
    agent: AgentConfigSchema,
    status: SessionStatusSchema,
    createdAt: z.date(),
    lastActivity: z.date(),
    error: z.string().optional(),
    containerOutput: z.string().optional(),
    containerName: z.string().optional(),
    claudeCodeVersion: z.string().optional(),
    agentStatus: AgentStatusSchema.optional(),
    agentStateTimestamp: z.date().optional(),
});
export type WorktreeSession = z.infer<typeof WorktreeSessionSchema>;

/**
 * Phase result types for viwo.start() decomposition
 */
export const CreateWorktreeResultSchema = z.object({
    sessionId: z.number(),
    repoPath: z.string(),
    branchName: z.string(),
    worktreePath: z.string(),
});
export type CreateWorktreeResult = z.infer<typeof CreateWorktreeResultSchema>;

export const CreateWorktreeOptionsSchema = z.object({
    repoId: z.number().min(0),
    branchName: z.string().optional(),
    envFile: z.string().optional(),
});
export type CreateWorktreeOptions = z.infer<typeof CreateWorktreeOptionsSchema>;

export const StartContainerOptionsSchema = z.object({
    sessionId: z.number(),
    worktreePath: z.string(),
    prompt: z.string().min(1),
    agent: AgentTypeSchema.default('claude-code'),
    model: z.string().optional(),
});
export type StartContainerOptions = z.infer<typeof StartContainerOptionsSchema>;

export const StartContainerResultSchema = z.object({
    containerId: z.string(),
    containerName: z.string(),
});
export type StartContainerResult = z.infer<typeof StartContainerResultSchema>;

/**
 * Init command options
 */
export const InitOptionsSchema = z.object({
    repoId: z.number().min(0),
    prompt: z.string().min(1),
    agent: AgentTypeSchema.default('claude-code'),
    branchName: z.string().optional(),
    dockerCompose: z.string().optional(),
    setupCommands: z.array(z.string()).optional(),
    envFile: z.string().optional(),
});
export type InitOptions = z.infer<typeof InitOptionsSchema>;

/**
 * List command options
 */
export const ListOptionsSchema = z.object({
    status: SessionStatusSchema.optional(),
    limit: z.number().int().positive().optional(),
});
export type ListOptions = z.infer<typeof ListOptionsSchema>;

/**
 * Cleanup command options
 */
export const CleanupOptionsSchema = z.object({
    sessionId: z.string().min(1),
    removeWorktree: z.boolean().default(true),
    stopContainers: z.boolean().default(true),
    removeContainers: z.boolean().default(true),
});
export type CleanupOptions = z.infer<typeof CleanupOptionsSchema>;

/**
 * Configuration schemas
 */
export const ViwoConfigSchema = z.object({
    stateDir: z.string().default('.viwo'),
    worktreesDir: z.string().default('.worktrees'),
    portRange: z
        .object({
            start: z.number().int().min(1024).max(65535).default(3000),
            end: z.number().int().min(1024).max(65535).default(9999),
        })
        .default({ start: 3000, end: 9999 }),
});
export type ViwoConfig = z.infer<typeof ViwoConfigSchema>;

/**
 * Project configuration schemas (from viwo.yml/viwo.yaml)
 */
export const ProjectConfigSchema = z.object({
    postInstall: z.array(z.string()).optional(),
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

/**
 * Authentication schemas
 */
export const AuthMethodSchema = z.enum(['api-key', 'oauth']);

export const OAuthCredentialsSchema = z.object({
    accessToken: z.string().startsWith('sk-ant-oat'),
    refreshToken: z.string().startsWith('sk-ant-ort'),
    expiresAt: z.number(),
    scopes: z.array(z.string()),
    subscriptionType: z.string().optional(),
    rateLimitTier: z.string().optional(),
});

export const OAuthAccountInfoSchema = z.object({
    accountUuid: z.string(),
    emailAddress: z.string(),
    organizationUuid: z.string().optional(),
    hasExtraUsageEnabled: z.boolean().optional(),
    billingType: z.string().optional(),
    displayName: z.string().optional(),
    organizationName: z.string().optional(),
});
