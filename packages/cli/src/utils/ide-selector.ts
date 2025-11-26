import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import {
	IDEManager,
	ConfigManager,
	type IDEType,
	type IDEInfo,
} from '@viwo/core';

export const selectAndOpenIDE = async (worktreePath: string): Promise<void> => {
	try {
		// Detect available IDEs
		const availableIDEs = await IDEManager.detectAvailableIDEs();

		if (availableIDEs.length === 0) {
			console.log();
			console.log(chalk.yellow('No supported IDEs detected'));
			console.log();
			console.log(chalk.gray('Install one of the following:'));
			console.log(chalk.cyan('  VSCode:    ') + chalk.gray('https://code.visualstudio.com'));
			console.log(chalk.cyan('  Cursor:    ') + chalk.gray('https://cursor.sh'));
			console.log(chalk.cyan('  JetBrains: ') + chalk.gray('https://www.jetbrains.com'));
			console.log();
			console.log(chalk.gray('Or navigate manually:'));
			console.log(chalk.yellow(`  cd ${worktreePath}`));
			console.log();
			return;
		}

		// Check for preferred IDE
		const preferred = ConfigManager.getPreferredIDE();
		let selectedIDE: IDEType;

		// If preferred IDE is set and still available, use it
		if (preferred && availableIDEs.some((ide) => ide.type === preferred)) {
			selectedIDE = preferred;
			console.log();
			console.log(chalk.gray(`Opening in ${IDEManager.getIDEDisplayName(selectedIDE)}...`));
		} else {
			// If preferred IDE was set but is no longer available
			if (preferred) {
				console.log();
				console.log(
					chalk.yellow(
						`Your preferred IDE (${IDEManager.getIDEDisplayName(preferred)}) is no longer available.`
					)
				);
				console.log();
			}

			// Show selection prompt
			selectedIDE = await select<IDEType>({
				message: 'Select IDE to open:',
				choices: availableIDEs.map((ide: IDEInfo) => ({
					name: ide.name,
					value: ide.type,
				})),
			});

			// Ask if user wants to save preference
			const shouldSave = await select<boolean>({
				message: 'Save as default IDE?',
				choices: [
					{ name: 'Yes', value: true },
					{ name: 'No', value: false },
				],
			});

			if (shouldSave) {
				ConfigManager.setPreferredIDE(selectedIDE);
				console.log();
				console.log(
					chalk.gray(`Saved ${IDEManager.getIDEDisplayName(selectedIDE)} as default IDE`)
				);
			}

			console.log();
			console.log(chalk.gray(`Opening in ${IDEManager.getIDEDisplayName(selectedIDE)}...`));
		}

		// Open the IDE
		await IDEManager.openInIDE(selectedIDE, worktreePath);

		console.log(chalk.green(`✓ Opened ${IDEManager.getIDEDisplayName(selectedIDE)}`));
		console.log();
	} catch (error) {
		console.log();
		console.log(chalk.red('✗ Failed to open IDE'));
		console.log(chalk.gray(error instanceof Error ? error.message : String(error)));
		console.log();
		console.log(chalk.yellow('Try:'));
		console.log(chalk.gray('  1. Check if IDE is installed correctly'));
		console.log(chalk.gray('  2. Ensure worktree path exists'));
		console.log(chalk.gray('  3. Try selecting a different IDE'));
		console.log();
	}
};
