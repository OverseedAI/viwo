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

/**
 * Supported IDE types
 */
export type IDEType =
    | 'vscode'
    | 'vscode-insiders'
    | 'cursor'
    | 'webstorm'
    | 'intellij-idea'
    | 'intellij-idea-ce'
    | 'pycharm'
    | 'pycharm-ce'
    | 'goland'
    | 'phpstorm'
    | 'rubymine'
    | 'clion'
    | 'datagrip'
    | 'rider';

/**
 * IDE information including availability status
 */
export interface IDEInfo {
    type: IDEType;
    name: string;
    command: string;
    available: boolean;
}
