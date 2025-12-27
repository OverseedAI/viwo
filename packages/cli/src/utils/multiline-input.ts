/**
 * Multiline input component with inline expansion and paste detection.
 *
 * Features:
 * - Starts as single-line input, expands as lines are added
 * - Enter submits the input
 * - Pasted multiline text does NOT trigger submission (detected via bracketed paste mode)
 * - Full keyboard navigation (arrows, home, end, backspace, delete)
 */
import * as readline from 'readline';
import chalk from 'chalk';
import {
    Terminal,
    PASTE_START,
    PASTE_END,
    enableRawMode,
    disableRawMode,
    write,
    getTerminalSize,
} from './terminal';

export interface MultilineInputOptions {
    message: string;
    placeholder?: string;
}

interface InputState {
    lines: string[];
    cursorRow: number;
    cursorCol: number;
    isPasting: boolean;
    pasteBuffer: string;
    headerLines: number; // Number of lines used by header (message + hint)
    lastRenderedLineCount: number;
    lastCursorTerminalRow: number; // Where we left the cursor in the last render
}

/**
 * Get the current line safely.
 */
const getCurrentLine = (state: InputState): string => {
    return state.lines[state.cursorRow] ?? '';
};

/**
 * Prompts for multiline text input with inline expansion.
 * Enter submits, but pasted multiline text is inserted without submission.
 */
export const multilineInput = async (options: MultilineInputOptions): Promise<string> => {
    const { message, placeholder } = options;

    const state: InputState = {
        lines: [''],
        cursorRow: 0,
        cursorCol: 0,
        isPasting: false,
        pasteBuffer: '',
        headerLines: 2, // message line + hint line
        lastRenderedLineCount: 0, // No content rendered yet
        lastCursorTerminalRow: 0, // Cursor starts at row 0
    };

    // Track if we've set up listeners to avoid double cleanup
    let isCleanedUp = false;
    let resizeHandler: (() => void) | null = null;

    const cleanup = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;

        // Disable bracketed paste mode
        write(Terminal.disableBracketedPaste());

        // Show cursor
        write(Terminal.showCursor());

        // Disable raw mode
        disableRawMode();

        // Remove resize listener
        if (resizeHandler) {
            process.stdout.removeListener('resize', resizeHandler);
        }
    };

    // Calculate how many terminal rows a line takes (accounting for wrapping)
    const getWrappedLineCount = (line: string): number => {
        const { columns } = getTerminalSize();
        // Account for the 2-character prefix indent
        const displayLength = line.length + 2;
        if (displayLength === 2) return 1; // Empty line with just prefix
        return Math.ceil(displayLength / columns) || 1;
    };

    // Calculate total terminal rows used by all content
    const getTotalRenderedRows = (): number => {
        return state.lines.reduce((acc, line) => acc + getWrappedLineCount(line), 0);
    };

    // Render the input area
    const render = () => {
        const { columns } = getTerminalSize();
        const totalRows = getTotalRenderedRows();

        if (state.lastRenderedLineCount > 0) {
            // Move cursor back to start of input area using the position from last render
            if (state.lastCursorTerminalRow > 0) {
                write(Terminal.moveCursorUp(state.lastCursorTerminalRow));
            }
            write('\r');
        }

        // Clear from cursor to end of screen
        write(Terminal.clearToEndOfScreen());

        // Render each line
        for (let i = 0; i < state.lines.length; i++) {
            const line = state.lines[i] ?? '';
            const prefix = '  '; // Indent to match clack style
            const content = prefix + line;

            if (line.length === 0 && placeholder && state.lines.length === 1 && i === 0) {
                // Show placeholder when empty
                write(prefix + chalk.gray(placeholder));
            } else {
                write(content);
            }

            // Add newline after each line
            write('\n');
        }

        // Position cursor at correct location
        // Calculate which row the cursor is on (accounting for wrapped lines)
        let cursorTerminalRow = 0;
        for (let i = 0; i < state.cursorRow; i++) {
            const line = state.lines[i] ?? '';
            cursorTerminalRow += getWrappedLineCount(line);
        }

        // Add position within current line (for wrapped lines)
        const currentLineCol = state.cursorCol + 2; // +2 for prefix indent
        cursorTerminalRow += Math.floor(currentLineCol / columns);
        const cursorTerminalCol = (currentLineCol % columns) + 1;

        // Move cursor back up from bottom
        // After rendering all lines with \n, cursor is on the line after all content
        // That's row totalRows (0-indexed from start of input area)
        // We want it at row cursorTerminalRow
        const rowsToGoUp = totalRows - cursorTerminalRow;
        if (rowsToGoUp > 0) {
            write(Terminal.moveCursorUp(rowsToGoUp));
        }
        write(Terminal.moveCursorToColumn(cursorTerminalCol));

        // Remember where we left the cursor for the next render
        state.lastRenderedLineCount = totalRows;
        state.lastCursorTerminalRow = cursorTerminalRow;
    };

    // Insert text at cursor position
    const insertText = (text: string) => {
        // Normalize line endings - convert \r\n or \r to \n
        const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const textLines = normalizedText.split('\n');
        const firstTextLine = textLines[0] ?? '';

        if (textLines.length === 1) {
            // Single line insert
            const currentLine = getCurrentLine(state);
            state.lines[state.cursorRow] =
                currentLine.slice(0, state.cursorCol) +
                firstTextLine +
                currentLine.slice(state.cursorCol);
            state.cursorCol += firstTextLine.length;
        } else {
            // Multiline insert
            const currentLine = getCurrentLine(state);
            const beforeCursor = currentLine.slice(0, state.cursorCol);
            const afterCursor = currentLine.slice(state.cursorCol);

            // First line: append to current position
            state.lines[state.cursorRow] = beforeCursor + firstTextLine;

            // Middle lines: insert as new lines
            for (let i = 1; i < textLines.length - 1; i++) {
                state.lines.splice(state.cursorRow + i, 0, textLines[i] ?? '');
            }

            // Last line: prepend remaining content
            const lastLineIndex = state.cursorRow + textLines.length - 1;
            const lastTextLine = textLines[textLines.length - 1] ?? '';
            state.lines.splice(lastLineIndex, 0, lastTextLine + afterCursor);

            // Update cursor position
            state.cursorRow = lastLineIndex;
            state.cursorCol = lastTextLine.length;
        }
    };

    // Handle backspace
    const handleBackspace = () => {
        if (state.cursorCol > 0) {
            // Delete character before cursor
            const line = getCurrentLine(state);
            state.lines[state.cursorRow] =
                line.slice(0, state.cursorCol - 1) + line.slice(state.cursorCol);
            state.cursorCol--;
        } else if (state.cursorRow > 0) {
            // Merge with previous line
            const currentLine = getCurrentLine(state);
            const prevLine = state.lines[state.cursorRow - 1] ?? '';
            state.lines[state.cursorRow - 1] = prevLine + currentLine;
            state.lines.splice(state.cursorRow, 1);
            state.cursorRow--;
            state.cursorCol = prevLine.length;
        }
    };

    // Handle delete key
    const handleDelete = () => {
        const line = getCurrentLine(state);
        if (state.cursorCol < line.length) {
            // Delete character at cursor
            state.lines[state.cursorRow] =
                line.slice(0, state.cursorCol) + line.slice(state.cursorCol + 1);
        } else if (state.cursorRow < state.lines.length - 1) {
            // Merge with next line
            const nextLine = state.lines[state.cursorRow + 1] ?? '';
            state.lines[state.cursorRow] = line + nextLine;
            state.lines.splice(state.cursorRow + 1, 1);
        }
    };

    // Handle enter key (new line when pasting, submit otherwise)
    const handleEnter = (): 'newline' | 'submit' => {
        if (state.isPasting) {
            // During paste, enter creates a new line
            const currentLine = getCurrentLine(state);
            const beforeCursor = currentLine.slice(0, state.cursorCol);
            const afterCursor = currentLine.slice(state.cursorCol);

            state.lines[state.cursorRow] = beforeCursor;
            state.lines.splice(state.cursorRow + 1, 0, afterCursor);
            state.cursorRow++;
            state.cursorCol = 0;
            return 'newline';
        }
        return 'submit';
    };

    // Cursor movement
    const moveCursorLeft = () => {
        if (state.cursorCol > 0) {
            state.cursorCol--;
        } else if (state.cursorRow > 0) {
            state.cursorRow--;
            state.cursorCol = getCurrentLine(state).length;
        }
    };

    const moveCursorRight = () => {
        const lineLength = getCurrentLine(state).length;
        if (state.cursorCol < lineLength) {
            state.cursorCol++;
        } else if (state.cursorRow < state.lines.length - 1) {
            state.cursorRow++;
            state.cursorCol = 0;
        }
    };

    const moveCursorUp = () => {
        if (state.cursorRow > 0) {
            state.cursorRow--;
            state.cursorCol = Math.min(state.cursorCol, getCurrentLine(state).length);
        }
    };

    const moveCursorDown = () => {
        if (state.cursorRow < state.lines.length - 1) {
            state.cursorRow++;
            state.cursorCol = Math.min(state.cursorCol, getCurrentLine(state).length);
        }
    };

    const moveCursorToLineStart = () => {
        state.cursorCol = 0;
    };

    const moveCursorToLineEnd = () => {
        state.cursorCol = getCurrentLine(state).length;
    };

    return new Promise<string>((resolve, reject) => {
        // Print header
        console.log();
        console.log(chalk.cyan('?') + ' ' + message);
        console.log(chalk.gray('  (Press Enter to submit, Alt+Enter for newline)'));
        console.log();

        // Enable raw mode
        if (!enableRawMode()) {
            reject(new Error('Could not enable raw mode - not a TTY'));
            return;
        }

        // Enable bracketed paste mode
        write(Terminal.enableBracketedPaste());

        // Enable keypress events (readline will parse bracketed paste sequences
        // and emit them as 'paste-start' and 'paste-end' keypress events)
        readline.emitKeypressEvents(process.stdin);

        // Initial render
        render();

        // Handle resize
        resizeHandler = () => render();
        process.stdout.on('resize', resizeHandler);

        // Handle keypresses
        const keypressHandler = (str: string | undefined, key: readline.Key) => {
            // Handle bracketed paste start
            if (key.name === 'paste-start') {
                state.isPasting = true;
                state.pasteBuffer = '';
                return;
            }

            // Handle bracketed paste end
            if (key.name === 'paste-end') {
                insertText(state.pasteBuffer);
                state.pasteBuffer = '';
                state.isPasting = false;
                render();
                return;
            }

            // If we're pasting, accumulate characters in buffer
            if (state.isPasting) {
                if (str) {
                    state.pasteBuffer += str;
                }
                return;
            }

            // Ctrl+C - cancel
            if (key.ctrl && key.name === 'c') {
                cleanup();
                process.stdin.removeListener('keypress', keypressHandler);
                console.log();
                reject(new Error('Operation cancelled'));
                return;
            }

            // Ctrl+D - submit (alternative to Enter)
            if (key.ctrl && key.name === 'd') {
                cleanup();
                process.stdin.removeListener('keypress', keypressHandler);
                const result = state.lines.join('\n').trim();
                console.log();
                if (!result) {
                    console.log(chalk.red('  Prompt cannot be empty'));
                    reject(new Error('Prompt cannot be empty'));
                    return;
                }
                resolve(result);
                return;
            }

            // Alt+Enter - insert newline
            if (key.name === 'return' && key.meta) {
                const currentLine = getCurrentLine(state);
                const beforeCursor = currentLine.slice(0, state.cursorCol);
                const afterCursor = currentLine.slice(state.cursorCol);

                state.lines[state.cursorRow] = beforeCursor;
                state.lines.splice(state.cursorRow + 1, 0, afterCursor);
                state.cursorRow++;
                state.cursorCol = 0;
                render();
                return;
            }

            // Enter - submit
            if (key.name === 'return') {
                const action = handleEnter();
                if (action === 'submit') {
                    cleanup();
                    process.stdin.removeListener('keypress', keypressHandler);
                    const result = state.lines.join('\n').trim();
                    console.log();
                    if (!result) {
                        console.log(chalk.red('  Prompt cannot be empty'));
                        reject(new Error('Prompt cannot be empty'));
                        return;
                    }
                    resolve(result);
                    return;
                }
                render();
                return;
            }

            // Backspace
            if (key.name === 'backspace') {
                handleBackspace();
                render();
                return;
            }

            // Delete
            if (key.name === 'delete') {
                handleDelete();
                render();
                return;
            }

            // Arrow keys
            if (key.name === 'left') {
                moveCursorLeft();
                render();
                return;
            }
            if (key.name === 'right') {
                moveCursorRight();
                render();
                return;
            }
            if (key.name === 'up') {
                moveCursorUp();
                render();
                return;
            }
            if (key.name === 'down') {
                moveCursorDown();
                render();
                return;
            }

            // Home/End
            if (key.name === 'home') {
                moveCursorToLineStart();
                render();
                return;
            }
            if (key.name === 'end') {
                moveCursorToLineEnd();
                render();
                return;
            }

            // Ctrl+A - start of input
            if (key.ctrl && key.name === 'a') {
                state.cursorRow = 0;
                state.cursorCol = 0;
                render();
                return;
            }

            // Ctrl+E - end of input
            if (key.ctrl && key.name === 'e') {
                state.cursorRow = state.lines.length - 1;
                state.cursorCol = getCurrentLine(state).length;
                render();
                return;
            }

            // Regular printable character
            if (str && str.length === 1 && !key.ctrl && !key.meta) {
                const charCode = str.charCodeAt(0);
                // Only handle printable characters (space and above, excluding DEL)
                if (charCode >= 32 && charCode !== 127) {
                    insertText(str);
                    render();
                }
            }
        };

        process.stdin.on('keypress', keypressHandler);

        // Handle process exit
        const exitHandler = () => {
            cleanup();
            process.stdin.removeListener('keypress', keypressHandler);
        };

        process.on('exit', exitHandler);
        process.on('SIGINT', () => {
            exitHandler();
            process.exit(130);
        });
    });
};
