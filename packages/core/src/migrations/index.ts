export interface Migration {
    version: number;
    name: string;
    up: string;
}

export const migrations: Migration[] = [
    {
        version: 1,
        name: 'last_skreet',
        up: `
            CREATE TABLE \`repositories\` (
            	\`id\` integer PRIMARY KEY NOT NULL,
            	\`name\` text NOT NULL,
            	\`path\` text NOT NULL,
            	\`url\` text,
            	\`createdAt\` text
            );
            
            CREATE TABLE \`configurations\` (
            	\`id\` integer PRIMARY KEY NOT NULL,
            	\`claudeApiToken\` integer
            );
            
            CREATE TABLE \`chats\` (
            	\`id\` integer PRIMARY KEY NOT NULL,
            	\`sessionId\` text,
            	\`type\` text,
            	\`content\` text,
            	\`createdAt\` text
            );
            
            CREATE TABLE \`sessions\` (
            	\`id\` integer PRIMARY KEY NOT NULL,
            	\`repoId\` integer NOT NULL,
            	\`name\` text NOT NULL,
            	\`path\` text NOT NULL,
            	\`gitWorktreeName\` text,
            	\`containerName\` text,
            	\`containerId\` text,
            	\`containerImage\` text,
            	\`agentId\` text,
            	\`status\` text,
            	\`error\` text,
            	\`createdAt\` text,
            	\`lastActivity\` text
            );
        `
    },
    {
        version: 2,
        name: 'opposite_marvel_boy',
        up: `
            ALTER TABLE \`sessions\` RENAME COLUMN "agentId" TO "agent";
            ALTER TABLE \`sessions\` ADD \`branchName\` text NOT NULL;
        `
    },
    {
        version: 3,
        name: 'cuddly_queen_noir',
        up: `
            PRAGMA foreign_keys=OFF;
            CREATE TABLE \`__new_sessions\` (
            	\`id\` integer PRIMARY KEY NOT NULL,
            	\`repoId\` integer NOT NULL,
            	\`name\` text NOT NULL,
            	\`path\` text NOT NULL,
            	\`branchName\` text NOT NULL,
            	\`gitWorktreeName\` text,
            	\`containerName\` text,
            	\`containerId\` text,
            	\`containerImage\` text,
            	\`agent\` text,
            	\`status\` text DEFAULT 'initializing',
            	\`error\` text,
            	\`createdAt\` text DEFAULT (CURRENT_TIMESTAMP),
            	\`lastActivity\` text DEFAULT (CURRENT_TIMESTAMP)
            );
            
            INSERT INTO \`__new_sessions\`("id", "repoId", "name", "path", "branchName", "gitWorktreeName", "containerName", "containerId", "containerImage", "agent", "status", "error", "createdAt", "lastActivity") SELECT "id", "repoId", "name", "path", "branchName", "gitWorktreeName", "containerName", "containerId", "containerImage", "agent", "status", "error", "createdAt", "lastActivity" FROM \`sessions\`;
            DROP TABLE \`sessions\`;
            ALTER TABLE \`__new_sessions\` RENAME TO \`sessions\`;
            PRAGMA foreign_keys=ON;
        `
    },
    {
        version: 4,
        name: 'high_doctor_strange',
        up: `
            PRAGMA foreign_keys=OFF;
            CREATE TABLE \`__new_configurations\` (
            	\`id\` integer PRIMARY KEY NOT NULL,
            	\`anthropic_api_key\` text,
            	\`created_at\` text,
            	\`updated_at\` text
            );
            
            INSERT INTO \`__new_configurations\`("id", "anthropic_api_key", "created_at", "updated_at") SELECT "id", "anthropic_api_key", "created_at", "updated_at" FROM \`configurations\`;
            DROP TABLE \`configurations\`;
            ALTER TABLE \`__new_configurations\` RENAME TO \`configurations\`;
            PRAGMA foreign_keys=ON;
        `
    },
    {
        version: 5,
        name: 'puzzling_anita_blake',
        up: `
            ALTER TABLE \`configurations\` ADD \`preferred_ide\` text;
        `
    }
];
