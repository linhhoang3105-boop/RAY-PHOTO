CREATE TABLE `ray_entitlements` (
	`user_id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`provider` text NOT NULL,
	`receipt_id` text NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ray_limits` (
	`id` text NOT NULL,
	`bucket` integer NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`id`, `bucket`)
);
--> statement-breakpoint
CREATE TABLE `ray_presets` (
	`code` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`recipe` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ray_visitors` (
	`id` text PRIMARY KEY NOT NULL,
	`csrf` text NOT NULL,
	`expires_at` integer NOT NULL
);
