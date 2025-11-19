CREATE TABLE `repositories` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`url` text,
	`createdAt` text
);
--> statement-breakpoint
CREATE TABLE `configurations` (
	`id` integer PRIMARY KEY NOT NULL,
	`claudeApiToken` integer
);
--> statement-breakpoint
CREATE TABLE `chats` (
	`id` integer PRIMARY KEY NOT NULL,
	`sessionId` text,
	`type` text,
	`content` text,
	`createdAt` text
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY NOT NULL,
	`repoId` integer NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`gitWorktreeName` text,
	`containerName` text,
	`containerId` text,
	`containerImage` text,
	`agentId` text,
	`status` text,
	`error` text,
	`createdAt` text,
	`lastActivity` text
);
