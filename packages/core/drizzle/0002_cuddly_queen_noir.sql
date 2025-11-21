PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` integer PRIMARY KEY NOT NULL,
	`repoId` integer NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`branchName` text NOT NULL,
	`gitWorktreeName` text,
	`containerName` text,
	`containerId` text,
	`containerImage` text,
	`agent` text,
	`status` text DEFAULT 'initializing',
	`error` text,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP),
	`lastActivity` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "repoId", "name", "path", "branchName", "gitWorktreeName", "containerName", "containerId", "containerImage", "agent", "status", "error", "createdAt", "lastActivity") SELECT "id", "repoId", "name", "path", "branchName", "gitWorktreeName", "containerName", "containerId", "containerImage", "agent", "status", "error", "createdAt", "lastActivity" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;