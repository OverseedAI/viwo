/**
 * Session status enum
 * Represents the possible states of a VIWO session
 */
export enum SessionStatus {
    INITIALIZING = 'initializing',
    RUNNING = 'running',
    COMPLETED = 'completed',
    STOPPED = 'stopped',
    ERROR = 'error',
    CLEANED = 'cleaned',
}