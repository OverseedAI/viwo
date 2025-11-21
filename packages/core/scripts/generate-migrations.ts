#!/usr/bin/env bun

/**
 * Script to convert Drizzle-generated SQL migrations into the JS migration format
 * used by the custom migration runner in packages/core/src/migrations/index.ts
 *
 * Usage: bun packages/core/scripts/generate-migrations.ts
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'path';

interface JournalEntry {
    idx: number;
    version: string;
    when: number;
    tag: string;
    breakpoints: boolean;
}

interface Journal {
    version: string;
    dialect: string;
    entries: JournalEntry[];
}

const DRIZZLE_DIR = path.join(import.meta.dir, '..', 'drizzle');
const MIGRATIONS_OUTPUT = path.join(import.meta.dir, '..', 'src', 'migrations', 'index.ts');

const generateMigrations = async (): Promise<void> => {
    // Read the journal file
    const journalPath = path.join(DRIZZLE_DIR, 'meta', '_journal.json');
    const journalContent = await readFile(journalPath, 'utf-8');
    const journal: Journal = JSON.parse(journalContent);

    console.log(`Found ${journal.entries.length} migrations in journal`);

    // Process each migration
    const migrations: { version: number; name: string; up: string }[] = [];

    for (const entry of journal.entries) {
        const sqlPath = path.join(DRIZZLE_DIR, `${entry.tag}.sql`);
        let sqlContent = await readFile(sqlPath, 'utf-8');

        // Remove Drizzle statement breakpoints
        sqlContent = sqlContent.replace(/--> statement-breakpoint\n?/g, '\n');

        // Escape backticks for template literals
        sqlContent = sqlContent.replace(/`/g, '\\`');

        // Escape ${} template expressions
        sqlContent = sqlContent.replace(/\$\{/g, '\\${');

        // Trim whitespace
        sqlContent = sqlContent.trim();

        // Extract a readable name from the tag (e.g., "0000_last_skreet" -> "last_skreet")
        const nameParts = entry.tag.split('_');
        const name = nameParts.slice(1).join('_');

        migrations.push({
            version: entry.idx + 1, // 1-indexed version
            name,
            up: sqlContent,
        });

        console.log(`  - Migration ${entry.idx + 1}: ${name}`);
    }

    // Generate the TypeScript file
    const output = `export interface Migration {
    version: number;
    name: string;
    up: string;
}

export const migrations: Migration[] = [
${migrations
    .map(
        (m) => `    {
        version: ${m.version},
        name: '${m.name}',
        up: \`
${m.up
    .split('\n')
    .map((line) => `            ${line}`)
    .join('\n')}
        \`
    }`
    )
    .join(',\n')}
];
`;

    await writeFile(MIGRATIONS_OUTPUT, output);
    console.log(`\nGenerated migrations file: ${MIGRATIONS_OUTPUT}`);
};

// Run the script
generateMigrations().catch((error) => {
    console.error('Error generating migrations:', error);
    process.exit(1);
});
