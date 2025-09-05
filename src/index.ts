import { z } from 'zod';
import {
  WorkspaceSchema,
  WorkspaceListSchema,
  type Workspace,
  type WorkspaceList,
} from './schemas.js';

const hardcodedWorkspaces: WorkspaceList = [
  {
    id: '1',
    name: 'Frontend Project',
    path: '/Users/dev/projects/frontend',
    description: 'React-based frontend application',
    tags: ['react', 'typescript', 'frontend'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'Backend API',
    path: '/Users/dev/projects/backend',
    description: 'Node.js REST API server',
    tags: ['nodejs', 'api', 'backend'],
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-10'),
  },
  {
    id: '3',
    name: 'Mobile App',
    path: '/Users/dev/projects/mobile',
    description: 'React Native mobile application',
    tags: ['react-native', 'mobile', 'ios', 'android'],
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-20'),
  },
];

export async function listWorkspaces(): Promise<WorkspaceList> {
  return WorkspaceListSchema.parse(hardcodedWorkspaces);
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  const workspaces = await listWorkspaces();
  return workspaces.find(ws => ws.id === id) || null;
}

export async function validateWorkspace(
  workspace: unknown
): Promise<Workspace> {
  return WorkspaceSchema.parse(workspace);
}

export {
  WorkspaceSchema,
  WorkspaceListSchema,
  type Workspace,
  type WorkspaceList,
};
