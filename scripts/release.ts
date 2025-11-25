#!/usr/bin/env bun
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';

const PACKAGES = ['packages/core', 'packages/cli'];

const validateVersion = (version: string): boolean => {
  return /^\d+\.\d+\.\d+$/.test(version);
};

const updatePackageVersion = async (
  packagePath: string,
  version: string
): Promise<void> => {
  const pkgJsonPath = join(process.cwd(), packagePath, 'package.json');
  const content = await readFile(pkgJsonPath, 'utf-8');
  const pkg = JSON.parse(content);
  pkg.version = version;
  await writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`✓ Updated ${packagePath}/package.json to ${version}`);
};

const main = async () => {
  const args = process.argv.slice(2);
  const version = args[0];

  if (!version) {
    console.error('Usage: bun scripts/release.ts <version>');
    console.error('Example: bun scripts/release.ts 0.1.2');
    process.exit(1);
  }

  if (!validateVersion(version)) {
    console.error('Invalid version format. Use semver: X.Y.Z');
    process.exit(1);
  }

  console.log(`\nReleasing version ${version}...\n`);

  // Update all package.json files
  for (const pkg of PACKAGES) {
    await updatePackageVersion(pkg, version);
  }

  // Git operations
  console.log('\nGit operations:');
  execSync('git add packages/*/package.json', { stdio: 'inherit' });
  execSync(`git commit -m "chore: bump version to ${version}"`, {
    stdio: 'inherit',
  });
  execSync(`git tag v${version}`, { stdio: 'inherit' });

  console.log('\n✓ Version bumped and tagged!');
  console.log(`\nNext steps:`);
  console.log(`  git push origin main`);
  console.log(`  git push origin v${version}`);
};

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});