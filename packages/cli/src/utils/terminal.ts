/**
 * Terminal utilities for ANSI escape codes and mode management.
 * Used for building custom terminal UI components.
 */

// Bracketed paste mode escape sequences
export const PASTE_START = '\x1b[200~';
export const PASTE_END = '\x1b[201~';

/**
 * ANSI escape code utilities for cursor and screen manipulation.
 */
export const Terminal = {
    // Cursor movement
    moveCursorUp: (n: number) => `\x1b[${n}A`,
    moveCursorDown: (n: number) => `\x1b[${n}B`,
    moveCursorRight: (n: number) => `\x1b[${n}C`,
    moveCursorLeft: (n: number) => `\x1b[${n}D`,
    moveCursorToColumn: (col: number) => `\x1b[${col}G`,
    saveCursor: () => '\x1b[s',
    restoreCursor: () => '\x1b[u',

    // Screen manipulation
    clearLine: () => '\x1b[2K',
    clearToEndOfLine: () => '\x1b[K',
    clearToEndOfScreen: () => '\x1b[J',

    // Cursor visibility
    hideCursor: () => '\x1b[?25l',
    showCursor: () => '\x1b[?25h',

    // Bracketed paste mode
    enableBracketedPaste: () => '\x1b[?2004h',
    disableBracketedPaste: () => '\x1b[?2004l',
};

/**
 * Enable raw mode on stdin for character-by-character input.
 */
export const enableRawMode = (): boolean => {
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        return true;
    }
    return false;
};

/**
 * Disable raw mode on stdin.
 */
export const disableRawMode = (): void => {
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
    }
};

/**
 * Write escape sequences to stdout.
 */
export const write = (str: string): void => {
    process.stdout.write(str);
};

/**
 * Get terminal dimensions.
 */
export const getTerminalSize = (): { columns: number; rows: number } => ({
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
});
