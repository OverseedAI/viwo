#!/usr/bin/env bun
import { execSync } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const PACKAGES = ['packages/core', 'packages/cli'];
const DOCKER_MANAGER_PATH = 'packages/core/src/managers/docker-manager.ts';

const validateVersion = (version: string): boolean => /^\d+\.\d+\.\d+$/.test(version);

const updatePackageVersion = async ({
    packagePath,
    version,
}: {
    packagePath: string;
    version: string;
}): Promise<void> => {
    const pkgJsonPath = join(process.cwd(), packagePath, 'package.json');
    const content = await readFile(pkgJsonPath, 'utf-8');
    const pkg = JSON.parse(content);
    pkg.version = version;

    await writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`✓ Updated ${packagePath}/package.json to ${version}`);
};

const updateClaudeCodeImageTag = async ({ version }: { version: string }): Promise<void> => {
    const dockerManagerPath = join(process.cwd(), DOCKER_MANAGER_PATH);
    const content = await readFile(dockerManagerPath, 'utf-8');
    const updatedContent = content.replace(
        /export const CLAUDE_CODE_IMAGE = 'overseedai\/viwo-claude-code:[^']+';/,
        `export const CLAUDE_CODE_IMAGE = 'overseedai/viwo-claude-code:${version}';`
    );

    if (updatedContent === content) {
        throw new Error(`Could not find CLAUDE_CODE_IMAGE in ${DOCKER_MANAGER_PATH}`);
    }

    await writeFile(dockerManagerPath, updatedContent);
    console.log(`✓ Updated ${DOCKER_MANAGER_PATH} to overseedai/viwo-claude-code:${version}`);
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

    for (const packagePath of PACKAGES) {
        await updatePackageVersion({ packagePath, version });
    }

    await updateClaudeCodeImageTag({ version });

    console.log('\nGit operations:');
    execSync(
        `git add ${PACKAGES.map((packagePath) => `${packagePath}/package.json`).join(' ')} ${DOCKER_MANAGER_PATH}`,
        {
            stdio: 'inherit',
        }
    );
    execSync(`git commit -m "chore: bump version to ${version}"`, {
        stdio: 'inherit',
    });
    execSync(`git tag v${version}`, { stdio: 'inherit' });

    console.log('\n✓ Version bumped, image tag updated, and release tagged!');
    console.log('\nNext steps:');
    console.log('  git push origin main');
    console.log(`  git push origin v${version}`);
};

main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
