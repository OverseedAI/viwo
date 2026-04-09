// Helper to convert database Session to WorktreeSession
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { Session, chats } from '../db-schemas';
import { SessionStatus, WorktreeSession } from '../schemas';
import { getRepositoryById } from '../managers/repository-manager';

// Helper to parse SQLite CURRENT_TIMESTAMP format (YYYY-MM-DD HH:MM:SS) to Date
const parseSqliteTimestamp = (timestamp: string | null | undefined): Date => {
    if (!timestamp) {
        return new Date();
    }

    // SQLite CURRENT_TIMESTAMP returns "YYYY-MM-DD HH:MM:SS" which needs to be converted to ISO 8601
    // Replace space with 'T' and add 'Z' for UTC timezone
    const isoString = timestamp.replace(' ', 'T') + 'Z';
    const date = new Date(isoString);

    // Fallback to current time if parsing fails
    return isNaN(date.getTime()) ? new Date() : date;
};

// Helper to derive container status from session status
const deriveContainerStatus = (
    sessionStatus: string | null
): 'created' | 'running' | 'exited' | 'error' | 'stopped' => {
    switch (sessionStatus) {
        case SessionStatus.RUNNING:
            return 'running';
        case SessionStatus.COMPLETED:
            return 'exited';
        case SessionStatus.ERROR:
            return 'error';
        case SessionStatus.STOPPED:
            return 'stopped';
        case SessionStatus.INITIALIZING:
            return 'created';
        default:
            return 'stopped';
    }
};

const getInitialPrompt = (sessionId: string): string => {
    const firstChat = db
        .select()
        .from(chats)
        .where(and(eq(chats.sessionId, sessionId), eq(chats.type, 'user')))
        .get();
    return firstChat?.content || '';
};

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
                      status: deriveContainerStatus(dbSession.status),
                      ports: [],
                      createdAt: parseSqliteTimestamp(dbSession.createdAt),
                  },
              ]
            : [],
        ports: [],
        agent: {
            type: (dbSession.agent as 'claude-code' | 'cline' | 'cursor') || 'claude-code',
            initialPrompt: getInitialPrompt(String(dbSession.id)),
        },
        status: (dbSession.status as SessionStatus) || 'initializing',
        createdAt: parseSqliteTimestamp(dbSession.createdAt),
        lastActivity: parseSqliteTimestamp(dbSession.lastActivity),
        error: dbSession.error || undefined,
        containerOutput: dbSession.containerOutput || undefined,
        containerName: dbSession.containerName || undefined,
        claudeCodeVersion: dbSession.claudeCodeVersion || undefined,
    };
};
