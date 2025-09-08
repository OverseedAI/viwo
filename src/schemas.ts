import { z } from 'zod';

export const WorktreeSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  worktreePath: z.string().optional(),
  worktreeBranch: z.string().optional(),
  containerIds: z.array(z.string()).default([]),
  status: z.enum(['active', 'inactive']).default('inactive'),
});

export const WorktreeListSchema = z.array(WorktreeSchema);

export type Worktree = z.infer<typeof WorktreeSchema>;
export type WorktreeList = z.infer<typeof WorktreeListSchema>;
