import { Command } from 'commander';
import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { IDEManager, ConfigManager, type IDEType, type IDEInfo } from '@viwo/core';

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

export const configCommand = new Command('config')
	.description('Manage VIWO configuration')
	.addCommand(ideCommand);
