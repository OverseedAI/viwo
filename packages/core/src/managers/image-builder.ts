import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { buildImage, checkImageExists, CLAUDE_CODE_IMAGE } from './docker-manager';

const DERIVED_IMAGE_PREFIX = 'viwo-derived';

export interface BuildDerivedImageOptions {
    dockerfilePath: string;
    repoPath: string;
}

export interface BuildDerivedImageResult {
    imageName: string;
    rebuilt: boolean;
}

/**
 * Builds a project-specific image that extends the viwo base image.
 *
 * Validates the Dockerfile's first FROM line matches CLAUDE_CODE_IMAGE so the
 * bootstrap script, dtach, and the `claude` user contracts still hold. Tags
 * the result by content hash so unchanged Dockerfiles reuse the cached image.
 */
export const buildDerivedImage = async (
    options: BuildDerivedImageOptions
): Promise<BuildDerivedImageResult> => {
    const { dockerfilePath, repoPath } = options;

    const absoluteDockerfile = isAbsolute(dockerfilePath)
        ? dockerfilePath
        : resolve(repoPath, dockerfilePath);

    if (!existsSync(absoluteDockerfile)) {
        throw new Error(`Dockerfile not found: ${absoluteDockerfile}`);
    }

    const contents = readFileSync(absoluteDockerfile, 'utf-8');

    assertExtendsBaseImage({ contents, dockerfilePath: absoluteDockerfile });

    // Hash the Dockerfile + the base image tag so a base-image upgrade also
    // triggers a rebuild even if the Dockerfile bytes are identical.
    const hash = createHash('sha256')
        .update(contents)
        .update('\0')
        .update(CLAUDE_CODE_IMAGE)
        .digest('hex')
        .slice(0, 12);

    const imageName = `${DERIVED_IMAGE_PREFIX}:${hash}`;

    if (await checkImageExists({ image: imageName })) {
        return { imageName, rebuilt: false };
    }

    await buildImage({
        dockerfilePath: absoluteDockerfile,
        imageName,
        context: repoPath,
    });

    return { imageName, rebuilt: true };
};

export interface AssertExtendsBaseImageOptions {
    contents: string;
    dockerfilePath: string;
}

/**
 * Throws if the Dockerfile's first non-comment line isn't `FROM <viwo base>`.
 * Exported for unit testing without needing a Docker daemon.
 */
export const assertExtendsBaseImage = (options: AssertExtendsBaseImageOptions): void => {
    const { contents, dockerfilePath } = options;

    const firstFrom = contents
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 0 && !line.startsWith('#'));

    if (!firstFrom || !/^FROM\s+/i.test(firstFrom)) {
        throw new Error(
            `${dockerfilePath}: first non-comment line must be a FROM ${CLAUDE_CODE_IMAGE} directive`
        );
    }

    const match = firstFrom.match(/^FROM\s+(\S+)/i);
    const fromImage = match?.[1];

    if (fromImage !== CLAUDE_CODE_IMAGE) {
        throw new Error(
            `${dockerfilePath}: must extend the viwo base image. Expected "FROM ${CLAUDE_CODE_IMAGE}" but found "FROM ${fromImage}". ` +
                `Pin the exact base tag so the bootstrap script and runtime contracts are guaranteed.`
        );
    }
};

export const imageBuilder = {
    buildDerivedImage,
    assertExtendsBaseImage,
};
