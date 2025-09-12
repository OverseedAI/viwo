#!/usr/bin/env bun

import { Command } from 'commander';
import { listWorktrees, getWorktree, type Worktree } from './index.js';
import { runPreflightChecks } from './preflight-checks.js';
import { createWorktree, removeWorktree, getWorktreeForWorktree } from './worktree-manager.js';
import {
    createContainer,
    stopWorktreeContainers,
    removeWorktreeContainers,
} from './container-manager.js';

const program = new Command();

function printWorktreeList(worktreeList: Worktree[]) {
    console.log('\nAvailable Worktrees:');
    console.log('====================');

    worktreeList.forEach(worktree => {
        printWorktreeDetails(worktree);
    });

    printSummary(worktreeList);
}

function printWorktreeDetails(worktree: Worktree) {
    const statusIcon = worktree.status === 'active' ? '🟢' : '⚪';
    const statusText = worktree.status === 'active' ? 'ACTIVE' : 'INACTIVE';

    console.log(`\n${statusIcon} ${worktree.name} (${statusText})`);
    console.log(`ID: ${worktree.id}`);
    console.log(`Path: ${worktree.path}`);

    if (worktree.worktreePath) {
        console.log(`Worktree: ${worktree.worktreePath}`);
        console.log(`Branch: ${worktree.worktreeBranch || 'unknown'}`);
    }

    if (worktree.containerIds.length > 0) {
        console.log(`Containers: ${worktree.containerIds.length} running`);
    }

    if (worktree.description) {
        console.log(`Description: ${worktree.description}`);
    }

    if (worktree.tags.length > 0) {
        console.log(`Tags: ${worktree.tags.join(', ')}`);
    }

    console.log(`Updated: ${worktree.updatedAt.toISOString().split('T')[0]}`);
    console.log('-'.repeat(50));
}

function printSummary(worktreeList: Worktree[]) {
    const activeCount = worktreeList.filter(w => w.status === 'active').length;
    console.log(`\n📊 Summary: ${activeCount}/${worktreeList.length} worktrees active`);
}

async function withPreflightChecks(action: () => Promise<void>) {
    const preflightResult = await runPreflightChecks();
    if (!preflightResult.success) {
        console.error(`❌ Preflight check failed: ${preflightResult.error}`);
        process.exit(1);
    }
    await action();
}

program.name('viwo').description('CLI for managing virtual workspaces').version('1.0.0');

program
    .command('list')
    .description('List all available workspaces')
    .option('-j, --json', 'output as JSON')
    .action(async options => {
        await withPreflightChecks(async () => {
            try {
                const worktreeList = await listWorktrees();

                if (options.json) {
                    console.log(JSON.stringify(worktreeList, null, 2));
                    return;
                }

                printWorktreeList(worktreeList);
            } catch (error) {
                console.error('Error listing worktrees:', error);
                process.exit(1);
            }
        });
    });

program
    .command('add <name> [branch]')
    .description('Add a new git worktree')
    .option('-d, --dir <directory>', 'directory to create worktree in', '..')
    .action(async (name, branch = 'main', options) => {
        await withPreflightChecks(async () => {
            try {
                console.log(`📁 Creating git worktree '${name}' from branch '${branch}'...`);

                const sourcePath = process.cwd();
                const worktreePath = await createWorktree(name, sourcePath, branch, options.dir);

                console.log(`✅ Git worktree created at: ${worktreePath}`);
                console.log(`🎉 Worktree '${name}' is ready!`);
                console.log(`💡 Use 'cd ${worktreePath}' to navigate to your new worktree`);
            } catch (error) {
                console.error('❌ Error creating worktree:', error);
                process.exit(1);
            }
        });
    });

program
    .command('remove <name>')
    .description('Remove a git worktree')
    .option('-f, --force', 'force removal without confirmation')
    .action(async (name, options) => {
        await withPreflightChecks(async () => {
            try {
                const worktreeInfo = await getWorktreeForWorktree(name);
                if (!worktreeInfo) {
                    console.error(`❌ Worktree '${name}' not found`);
                    process.exit(1);
                }

                if (!options.force) {
                    console.log(`⚠️  This will remove the git worktree '${name}'`);
                    console.log(`   Path: ${worktreeInfo.path}`);
                    console.log(`   Branch: ${worktreeInfo.branch}`);
                    console.log('\n   Use --force to skip this confirmation');
                    process.exit(0);
                }

                console.log(`🗑️  Removing git worktree '${name}'...`);
                await removeWorktree(worktreeInfo.path);
                console.log(`✅ Git worktree '${name}' removed`);
            } catch (error) {
                console.error('❌ Error removing worktree:', error);
                process.exit(1);
            }
        });
    });

program
    .command('create <worktree-id> [branch]')
    .description('Create a new worktree for the worktree')
    .option('-c, --container', 'also create a development container')
    .option('-d, --dir <directory>', 'directory to create worktree in', '..')
    .action(async (worktreeId, branch = 'main', options) => {
        await withPreflightChecks(async () => {
            try {
                const worktree = await getWorktree(worktreeId);
                if (!worktree) {
                    console.error(`❌ Worktree '${worktreeId}' not found`);
                    process.exit(1);
                }

                console.log(`📁 Creating worktree for '${worktree.name}'...`);

                const worktreePath = await createWorktree(
                    worktreeId,
                    worktree.path,
                    branch,
                    options.dir
                );
                console.log(`✅ Worktree created at: ${worktreePath}`);

                if (options.container) {
                    console.log(`🐳 Creating development container...`);
                    const containerId = await createContainer(worktreeId, 'dev', {
                        image: 'node:18-alpine',
                        workingDir: '/workspace',
                        volumes: [`${worktreePath}:/workspace`],
                        ports: ['3000:3000', '8080:8080'],
                        command: ['sleep', 'infinity'],
                    });
                    console.log(`✅ Container created: ${containerId.substring(0, 12)}`);
                }

                console.log(`\n🎉 Worktree '${worktree.name}' is ready!`);
                if (options.container) {
                    console.log(`🔗 Access your container: docker exec -it ${worktreeId} sh`);
                }
            } catch (error) {
                console.error('❌ Error creating worktree:', error);
                process.exit(1);
            }
        });
    });

program
    .command('start <worktree-id>')
    .description('Start containers for an existing worktree')
    .action(async worktreeId => {
        await withPreflightChecks(async () => {
            try {
                const worktree = await getWorktree(worktreeId);
                if (!worktree) {
                    console.error(`❌ Worktree '${worktreeId}' not found`);
                    process.exit(1);
                }

                if (!worktree.worktreePath) {
                    console.error(
                        `❌ No worktree found for worktree '${worktreeId}'. Run 'viwo create ${worktreeId}' first.`
                    );
                    process.exit(1);
                }

                console.log(`🐳 Starting development container for '${worktree.name}'...`);
                const containerId = await createContainer(worktreeId, 'dev', {
                    image: 'node:18-alpine',
                    workingDir: '/workspace',
                    volumes: [`${worktree.worktreePath}:/workspace`],
                    ports: ['3000:3000', '8080:8080'],
                    command: ['sleep', 'infinity'],
                });

                console.log(`✅ Container started: ${containerId.substring(0, 12)}`);
                console.log(
                    `🔗 Access your container: docker exec -it ${containerId.substring(0, 12)} sh`
                );
            } catch (error) {
                console.error('❌ Error starting worktree:', error);
                process.exit(1);
            }
        });
    });

program
    .command('stop <worktree-id>')
    .description('Stop all containers for a worktree')
    .action(async worktreeId => {
        await withPreflightChecks(async () => {
            try {
                console.log(`🛑 Stopping containers for worktree '${worktreeId}'...`);
                await stopWorktreeContainers(worktreeId);
                console.log(`✅ Containers stopped`);
            } catch (error) {
                console.error('❌ Error stopping containers:', error);
                process.exit(1);
            }
        });
    });

program
    .command('clean <worktree-id>')
    .description('Remove worktree and all containers for a worktree')
    .option('-f, --force', 'force removal without confirmation')
    .action(async (worktreeId, options) => {
        await withPreflightChecks(async () => {
            try {
                const worktree = await getWorktree(worktreeId);
                if (!worktree) {
                    console.error(`❌ Worktree '${worktreeId}' not found`);
                    process.exit(1);
                }

                if (!options.force) {
                    console.log(
                        `⚠️  This will remove the worktree and all containers for '${worktree.name}'`
                    );
                    console.log(`   Worktree: ${worktree.worktreePath || 'none'}`);
                    console.log(`   Containers: ${worktree.containerIds.length}`);
                    console.log('\n   Use --force to skip this confirmation');
                    process.exit(0);
                }

                console.log(`🧹 Cleaning up worktree '${worktree.name}'...`);

                if (worktree.worktreePath) {
                    await removeWorktree(worktree.worktreePath);
                    console.log(`✅ Worktree removed`);
                }

                await removeWorktreeContainers(worktreeId);
                console.log(`✅ Containers removed`);

                console.log(`🎉 Worktree '${worktree.name}' cleaned up`);
            } catch (error) {
                console.error('❌ Error cleaning worktree:', error);
                process.exit(1);
            }
        });
    });

program.parse();
