// Helper to convert database Session to WorktreeSession
import { Session } from '../db-schemas';
import { SessionStatus, WorktreeSession } from '../schemas';
import { getRepositoryById } from '../managers/repository-manager';

export const sessionToWorktreeSession = (dbSession: Session): WorktreeSession | null => {
    const repository = getRepositoryById({ id: dbSession.repoId });
    if (!repository) {
        return null;
    }

    return {
        id: String(dbSession.id),
        repoPath: repository.path,
        branchName: dbSession.branchName,
        worktreePath: dbSession.path,
        containers: dbSession.containerId
            ? [
                  {
                      id: dbSession.containerId,
                      name: dbSession.containerName || '',
                      image: dbSession.containerImage || '',
                      status: 'running',
                      ports: [],
                      createdAt: new Date(dbSession.createdAt || Date.now()),
                  },
              ]
            : [],
        ports: [],
        agent: {
            type: (dbSession.agent as 'claude-code' | 'cline' | 'cursor') || 'claude-code',
            initialPrompt: '', // Not stored in db
        },
        status: (dbSession.status as SessionStatus) || 'initializing',
        createdAt: new Date(dbSession.createdAt || Date.now()),
        lastActivity: new Date(dbSession.lastActivity || Date.now()),
        error: dbSession.error || undefined,
    };
};
