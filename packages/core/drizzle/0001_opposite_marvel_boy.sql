ALTER TABLE `sessions` RENAME COLUMN "agentId" TO "agent";--> statement-breakpoint
ALTER TABLE `sessions` ADD `branchName` text NOT NULL;