import { z } from 'zod';

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
    'initializing',
    'running',
    'stopped',
    'error',
    'cleaned',
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

/**
 * Worktree session schemas
 */
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
    containerId: z.string().optional(),
    containerName: z.string().optional(),
});
export type WorktreeSession = z.infer<typeof WorktreeSessionSchema>;

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
