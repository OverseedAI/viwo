import { Command } from 'commander';
import { select, input } from '@inquirer/prompts';
import chalk from 'chalk';
import { IDEManager, ConfigManager, type IDEType, type IDEInfo, AppPaths } from '@viwo/core';
import { isAbsolute } from 'path';

const runIDEConfig = async (): Promise<void> => {
	try {
		console.clear();
		console.log();
		console.log(chalk.bold.cyan('IDE Configuration'));
		console.log(chalk.gray('═'.repeat(70)));
		console.log();

		// Detect available IDEs
		const availableIDEs = await IDEManager.detectAvailableIDEs();

		if (availableIDEs.length === 0) {
			console.log(chalk.yellow('No supported IDEs detected'));
			console.log();
			console.log(chalk.gray('Install one of the following:'));
			console.log(chalk.cyan('  VSCode:    ') + chalk.gray('https://code.visualstudio.com'));
			console.log(chalk.cyan('  Cursor:    ') + chalk.gray('https://cursor.sh'));
			console.log(chalk.cyan('  JetBrains: ') + chalk.gray('https://www.jetbrains.com'));
			console.log();
			return;
		}

		// Get current preference
		const currentPreference = ConfigManager.getPreferredIDE();

		console.log(chalk.bold('Current Default IDE'));
		if (currentPreference) {
			console.log(
				chalk.gray('  ') +
					chalk.green(IDEManager.getIDEDisplayName(currentPreference)) +
					chalk.gray(` (${currentPreference})`)
			);
		} else {
			console.log(chalk.gray('  None - you will be prompted to choose each time'));
		}
		console.log();
		console.log(chalk.gray('═'.repeat(70)));
		console.log();

		// Build choices
		const choices = availableIDEs.map((ide: IDEInfo) => ({
			name:
				ide.type === currentPreference
					? `${ide.name} ${chalk.green('(current)')}`
					: ide.name,
			value: ide.type,
			description: ide.command,
		}));

		// Add separator and remove option
		choices.push({
			name: chalk.gray('─'.repeat(70)),
			value: '__separator__' as IDEType,
			description: '',
		});

		choices.push({
			name: chalk.yellow('Remove default IDE'),
			value: '__remove__' as IDEType,
			description: 'You will be prompted to choose each time',
		});

		choices.push({
			name: chalk.gray('❌ Cancel'),
			value: '__cancel__' as IDEType,
			description: 'Exit without changes',
		});

		// Show selection
		const selection = await select<IDEType>({
			message: 'Select your default IDE:',
			choices,
			pageSize: 15,
		});

		// Handle selection
		if (selection === '__cancel__' || selection === '__separator__') {
			console.log();
			console.log(chalk.gray('No changes made'));
			console.log();
			return;
		}

		if (selection === '__remove__') {
			// Remove default IDE
			if (!currentPreference) {
				console.log();
				console.log(chalk.yellow('No default IDE is currently set'));
				console.log();
				return;
			}

			// Confirm removal
			const confirmRemove = await select<boolean>({
				message: chalk.yellow(
					`Remove ${IDEManager.getIDEDisplayName(currentPreference)} as default IDE?`
				),
				choices: [
					{ name: 'No, cancel', value: false },
					{ name: 'Yes, remove', value: true },
				],
			});

			if (confirmRemove) {
				ConfigManager.deletePreferredIDE();
				console.log();
				console.log(chalk.green('✓ Default IDE removed'));
				console.log(chalk.gray('  You will be prompted to choose an IDE each time'));
				console.log();
			} else {
				console.log();
				console.log(chalk.gray('No changes made'));
				console.log();
			}
			return;
		}

		// Set new default IDE
		if (selection === currentPreference) {
			console.log();
			console.log(
				chalk.yellow(
					`${IDEManager.getIDEDisplayName(selection)} is already your default IDE`
				)
			);
			console.log();
			return;
		}

		ConfigManager.setPreferredIDE(selection);
		console.log();
		console.log(
			chalk.green(
				`✓ Set ${IDEManager.getIDEDisplayName(selection)} as default IDE`
			)
		);
		console.log();
	} catch (error) {
		if ((error as any).name === 'ExitPromptError') {
			// User pressed Ctrl+C
			console.log();
			console.log(chalk.gray('Operation cancelled'));
			console.log();
			process.exit(0);
		}
		throw error;
	}
};

const ideCommand = new Command('ide')
	.description('Configure default IDE')
	.action(async () => {
		try {
			await runIDEConfig();
		} catch (error) {
			console.error(
				chalk.red('Configuration failed:'),
				error instanceof Error ? error.message : String(error)
			);
			process.exit(1);
		}
	});

const runWorktreesLocationConfig = async (): Promise<void> => {
	try {
		console.clear();
		console.log();
		console.log(chalk.bold.cyan('Worktrees Storage Location'));
		console.log(chalk.gray('═'.repeat(70)));
		console.log();

		// Get current worktrees location
		const currentLocation = ConfigManager.getWorktreesStorageLocation();
		const defaultLocation = AppPaths.joinDataPath('worktrees');

		console.log(chalk.bold('Current Worktrees Location'));
		if (currentLocation) {
			console.log(chalk.gray('  ') + chalk.green(currentLocation));
		} else {
			console.log(chalk.gray('  ') + chalk.yellow('Default: ') + chalk.white(defaultLocation));
		}
		console.log();
		console.log(chalk.gray('═'.repeat(70)));
		console.log();

		// Show selection
		const action = await select<string>({
			message: 'What would you like to do?',
			choices: [
				{
					name: chalk.cyan('Set custom location'),
					value: 'set',
					description: 'Specify a custom directory for git worktrees',
				},
				{
					name: chalk.yellow('Reset to default'),
					value: 'reset',
					description: `Use default location: ${defaultLocation}`,
				},
				{
					name: chalk.gray('❌ Cancel'),
					value: 'cancel',
					description: 'Exit without changes',
				},
			],
			pageSize: 10,
		});

		if (action === 'cancel') {
			console.log();
			console.log(chalk.gray('No changes made'));
			console.log();
			return;
		}

		if (action === 'reset') {
			// Reset to default
			if (!currentLocation) {
				console.log();
				console.log(chalk.yellow('Already using default location'));
				console.log();
				return;
			}

			// Confirm reset
			const confirmReset = await select<boolean>({
				message: chalk.yellow('Reset worktrees location to default?'),
				choices: [
					{ name: 'No, cancel', value: false },
					{ name: 'Yes, reset', value: true },
				],
			});

			if (confirmReset) {
				ConfigManager.deleteWorktreesStorageLocation();
				console.log();
				console.log(chalk.green('✓ Worktrees location reset to default'));
				console.log(chalk.gray('  ') + chalk.white(defaultLocation));
				console.log();
			} else {
				console.log();
				console.log(chalk.gray('No changes made'));
				console.log();
			}
			return;
		}

		if (action === 'set') {
			// Set custom location
			console.log();
			console.log(chalk.gray('Enter the path where git worktrees should be stored.'));
			console.log(chalk.gray('You can use:'));
			console.log(chalk.gray('  • Absolute path (e.g., /home/user/viwo-worktrees)'));
			console.log(chalk.gray('  • Tilde expansion (e.g., ~/.config/viwo)'));
			console.log(chalk.gray('  • Relative path (relative to app data directory)'));
			console.log();

			const newLocation = await input({
				message: 'Worktrees location:',
				default: currentLocation || defaultLocation,
				validate: (value: string) => {
					if (!value || value.trim() === '') {
						return 'Location cannot be empty';
					}
					return true;
				},
			});

			const trimmedLocation = newLocation.trim();
			// Expand tilde to show the actual path
			const expandedLocation = AppPaths.expandTilde(trimmedLocation);

			// Confirm the new location
			console.log();
			console.log(chalk.bold('New Worktrees Location'));
			console.log(chalk.gray('  ') + chalk.white(trimmedLocation));
			if (!isAbsolute(expandedLocation)) {
				const resolvedPath = AppPaths.joinDataPath(expandedLocation);
				console.log(chalk.gray('  Resolved to: ') + chalk.cyan(resolvedPath));
			} else if (expandedLocation !== trimmedLocation) {
				// Show expanded path if tilde was used
				console.log(chalk.gray('  Expands to: ') + chalk.cyan(expandedLocation));
			}
			console.log();

			const confirmSet = await select<boolean>({
				message: 'Save this location?',
				choices: [
					{ name: 'Yes, save', value: true },
					{ name: 'No, cancel', value: false },
				],
			});

			if (confirmSet) {
				ConfigManager.setWorktreesStorageLocation(trimmedLocation);
				console.log();
				console.log(chalk.green('✓ Worktrees location updated'));
				console.log(chalk.gray('  ') + chalk.white(trimmedLocation));
				console.log();
			} else {
				console.log();
				console.log(chalk.gray('No changes made'));
				console.log();
			}
		}
	} catch (error) {
		if ((error as any).name === 'ExitPromptError') {
			// User pressed Ctrl+C
			console.log();
			console.log(chalk.gray('Operation cancelled'));
			console.log();
			process.exit(0);
		}
		throw error;
	}
};

const worktreesCommand = new Command('worktrees')
	.description('Configure worktrees storage location')
	.action(async () => {
		try {
			await runWorktreesLocationConfig();
		} catch (error) {
			console.error(
				chalk.red('Configuration failed:'),
				error instanceof Error ? error.message : String(error)
			);
			process.exit(1);
		}
	});

export const configCommand = new Command('config')
	.description('Manage VIWO configuration')
	.addCommand(ideCommand)
	.addCommand(worktreesCommand);
