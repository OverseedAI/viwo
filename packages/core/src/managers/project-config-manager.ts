import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
import { ProjectConfigSchema, type ProjectConfig } from '../schemas';

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

// Namespace export for consistency with other managers
export const projectConfig = {
    loadProjectConfig,
    hasProjectConfig,
};
