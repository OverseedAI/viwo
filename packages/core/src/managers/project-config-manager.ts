import { existsSync, readFileSync } from 'fs';
import { isAbsolute, join, resolve } from 'path';
import YAML from 'yaml';
import { ProjectConfigSchema, type CustomBind, type ProjectConfig } from '../schemas';
import { expandTilde } from '../utils/paths';

export interface LoadProjectConfigOptions {
    repoPath: string;
}

/**
 * Attempts to load project configuration from viwo.yml or viwo.yaml
 * Returns null if no configuration file is found
 */
export const loadProjectConfig = (options: LoadProjectConfigOptions): ProjectConfig | null => {
    const { repoPath } = options;

    // Check for viwo.yml first, then viwo.yaml
    const configFiles = ['viwo.yml', 'viwo.yaml'];

    for (const filename of configFiles) {
        const configPath = join(repoPath, filename);

        if (existsSync(configPath)) {
            try {
                const fileContent = readFileSync(configPath, 'utf-8');
                const parsed = YAML.parse(fileContent);

                // Empty YAML files parse to null — treat as empty config
                if (parsed === null || parsed === undefined) {
                    return {};
                }

                // Validate with Zod schema
                const validated = ProjectConfigSchema.parse(parsed);
                return validated;
            } catch (error) {
                throw new Error(
                    `Failed to parse ${filename}: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    }

    return null;
};

/**
 * Checks if a project configuration file exists
 */
export const hasProjectConfig = (options: LoadProjectConfigOptions): boolean => {
    const { repoPath } = options;
    const configFiles = ['viwo.yml', 'viwo.yaml'];

    return configFiles.some((filename) => existsSync(join(repoPath, filename)));
};

export interface ResolveCustomBindsOptions {
    binds: CustomBind[];
    repoPath: string;
}

/**
 * Normalize a `binds` config entry into a Docker bind string
 * (`hostPath:containerPath[:ro]`).
 *
 * - Accepts string form (`"./data:/data"` or `"./data:/data:ro"`) or object form
 *   (`{ source, target, readonly }`).
 * - Expands `~` in host paths.
 * - Resolves relative host paths against the repo root so they behave
 *   predictably regardless of where `viwo` is invoked.
 * - Container paths must be absolute.
 */
export const resolveCustomBinds = (options: ResolveCustomBindsOptions): string[] => {
    const { binds, repoPath } = options;

    return binds.map((bind) => {
        let source: string;
        let target: string;
        let mode: string | undefined;

        if (typeof bind === 'string') {
            // Split from the right so Windows-style "C:\foo:/bar" still parses.
            // Expected forms: "src:dst" or "src:dst:ro"
            const parts = bind.split(':');
            if (parts.length < 2) {
                throw new Error(
                    `Invalid bind "${bind}": expected "source:target" or "source:target:ro"`
                );
            }
            if (parts.length === 2) {
                source = parts[0]!;
                target = parts[1]!;
            } else {
                // Last segment may be a mode flag (ro/rw); otherwise treat as part of target path
                const last = parts[parts.length - 1]!;
                if (last === 'ro' || last === 'rw') {
                    mode = last;
                    target = parts[parts.length - 2]!;
                    source = parts.slice(0, parts.length - 2).join(':');
                } else {
                    target = last;
                    source = parts.slice(0, parts.length - 1).join(':');
                }
            }
        } else {
            source = bind.source;
            target = bind.target;
            if (bind.readonly) mode = 'ro';
        }

        if (!source || !target) {
            throw new Error(`Invalid bind: source and target are required`);
        }

        if (!isAbsolute(target)) {
            throw new Error(`Invalid bind target "${target}": must be an absolute path`);
        }

        const expandedSource = expandTilde(source);
        const resolvedSource = isAbsolute(expandedSource)
            ? expandedSource
            : resolve(repoPath, expandedSource);

        return mode ? `${resolvedSource}:${target}:${mode}` : `${resolvedSource}:${target}`;
    });
};

// Namespace export for consistency with other managers
export const projectConfig = {
    loadProjectConfig,
    hasProjectConfig,
    resolveCustomBinds,
};
