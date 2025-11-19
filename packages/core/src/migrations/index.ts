export interface Migration {
    version: number;
    name: string;
    up: string;
}

export const migrations: Migration[] = [
    {
        version: 1,
        name: 'initial_schema',
        up: `
            CREATE TABLE IF NOT EXISTS repositories (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                url TEXT,
                createdAt TEXT
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY,
                repoId INTEGER NOT NULL,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                gitWorktreeName TEXT,
                containerName TEXT,
                containerId TEXT,
                containerImage TEXT,
                agentId TEXT,
                status TEXT,
                error TEXT,
                createdAt TEXT,
                lastActivity TEXT
            );

            CREATE TABLE IF NOT EXISTS chats (
                id INTEGER PRIMARY KEY,
                sessionId TEXT,
                type TEXT,
                content TEXT,
                createdAt TEXT
            );

            CREATE TABLE IF NOT EXISTS configurations (
                id INTEGER PRIMARY KEY,
                claudeApiToken INTEGER
            );
        `
    }
];
