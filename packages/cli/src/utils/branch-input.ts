/**
 * Single-line text input for git branch names that rejects disallowed
 * characters at input time rather than at submission.
 *
 * Built on top of @clack/core's TextPrompt so styling matches the rest of
 * the CLI, but hooks into the 'value' event to strip any characters that
 * are always invalid in a git branch name the moment they are typed.
 */
import { TextPrompt, isCancel } from '@clack/core';
import chalk from 'chalk';

// Always-invalid characters in a git branch name. Contextual rules (leading
// hyphen, consecutive dots, trailing .lock, @{, etc.) are still enforced by
// GitManager.validateBranchName at submission time.
const ALWAYS_INVALID_BRANCH_CHARS = /[\s~^:?*[\\]/g;

// clack-style symbols
const S_BAR = '│';
const S_BAR_END = '└';
const S_STEP_ACTIVE = '◆';
const S_STEP_SUBMIT = '◇';
const S_STEP_CANCEL = '■';
const S_STEP_ERROR = '▲';

const stateSymbol = (state: string): string => {
    switch (state) {
        case 'initial':
        case 'active':
            return chalk.cyan(S_STEP_ACTIVE);
        case 'cancel':
            return chalk.red(S_STEP_CANCEL);
        case 'error':
            return chalk.yellow(S_STEP_ERROR);
        case 'submit':
            return chalk.green(S_STEP_SUBMIT);
        default:
            return chalk.cyan(S_STEP_ACTIVE);
    }
};

export interface BranchNameInputOptions {
    message: string;
    placeholder?: string;
    validate?: (value: string) => string | undefined;
}

export const branchNameInput = async (opts: BranchNameInputOptions): Promise<string | symbol> => {
    const prompt = new TextPrompt({
        placeholder: opts.placeholder,
        validate: opts.validate ? (value: string) => opts.validate!(value) : undefined,
        render() {
            const header = `${chalk.gray(S_BAR)}\n${stateSymbol(this.state)}  ${opts.message}\n`;

            const placeholder = opts.placeholder
                ? chalk.inverse(opts.placeholder[0]) + chalk.dim(opts.placeholder.slice(1))
                : chalk.inverse(chalk.hidden('_'));

            const value = this.value ? this.valueWithCursor : placeholder;

            switch (this.state) {
                case 'error':
                    return `${header.trim()}\n${chalk.yellow(S_BAR)}  ${value}\n${chalk.yellow(S_BAR_END)}  ${chalk.yellow(this.error)}\n`;
                case 'submit':
                    return `${header}${chalk.gray(S_BAR)}  ${chalk.dim(this.value || opts.placeholder || '')}`;
                case 'cancel':
                    return `${header}${chalk.gray(S_BAR)}  ${chalk.strikethrough(chalk.dim(this.value ?? ''))}${this.value?.trim() ? `\n${chalk.gray(S_BAR)}` : ''}`;
                default:
                    return `${header}${chalk.cyan(S_BAR)}  ${value}\n${chalk.cyan(S_BAR_END)}\n`;
            }
        },
    });

    // Strip always-invalid characters the moment they are typed. The 'value'
    // event fires after readline has already accepted the keystroke, so we
    // also have to rewrite readline's internal line buffer so that the next
    // keystroke sees the cleaned state.
    prompt.on('value', () => {
        const current: string = prompt.value ?? '';
        const cleaned = current.replace(ALWAYS_INVALID_BRANCH_CHARS, '');
        if (cleaned !== current) {
            prompt.value = cleaned;
            // `rl` is private in the type defs but accessible at runtime.
            const rl = (prompt as unknown as { rl?: { line: string; cursor: number } }).rl;
            if (rl) {
                rl.line = cleaned;
                rl.cursor = cleaned.length;
            }
        }
    });

    return prompt.prompt();
};

export { isCancel };
