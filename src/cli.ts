#!/usr/bin/env node

import { Command } from 'commander';
import { listWorkspaces } from './index.js';
import { runPreflightChecks } from './preflight-checks.js';

const program = new Command();

async function withPreflightChecks(action: () => Promise<void>) {
  const preflightResult = await runPreflightChecks();
  if (!preflightResult.success) {
    console.error(`❌ Preflight check failed: ${preflightResult.error}`);
    process.exit(1);
  }
  await action();
}

program
  .name('virtual-workspaces')
  .description('CLI for managing virtual workspaces')
  .version('1.0.0');

program
  .command('list')
  .description('List all available workspaces')
  .option('-j, --json', 'output as JSON')
  .action(async options => {
    await withPreflightChecks(async () => {
      try {
        const workspaceList = await listWorkspaces();

        if (options.json) {
          console.log(JSON.stringify(workspaceList, null, 2));
        } else {
          console.log('\nAvailable Workspaces:');
          console.log('====================');

          workspaceList.forEach(workspace => {
            console.log(`\nID: ${workspace.id}`);
            console.log(`Name: ${workspace.name}`);
            console.log(`Path: ${workspace.path}`);
            if (workspace.description) {
              console.log(`Description: ${workspace.description}`);
            }
            if (workspace.tags.length > 0) {
              console.log(`Tags: ${workspace.tags.join(', ')}`);
            }
            console.log(
              `Created: ${workspace.createdAt.toISOString().split('T')[0]}`
            );
            console.log(
              `Updated: ${workspace.updatedAt.toISOString().split('T')[0]}`
            );
            console.log('-'.repeat(40));
          });
        }
      } catch (error) {
        console.error('Error listing workspaces:', error);
        process.exit(1);
      }
    });
  });

program.parse();
