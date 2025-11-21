PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_configurations` (
	`id` integer PRIMARY KEY NOT NULL,
	`anthropic_api_key` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
INSERT INTO `__new_configurations`("id", "anthropic_api_key", "created_at", "updated_at") SELECT "id", "anthropic_api_key", "created_at", "updated_at" FROM `configurations`;--> statement-breakpoint
DROP TABLE `configurations`;--> statement-breakpoint
ALTER TABLE `__new_configurations` RENAME TO `configurations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;