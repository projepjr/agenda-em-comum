CREATE TABLE `availability` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`start_minute` integer NOT NULL,
	`end_minute` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organizer_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`date` text NOT NULL,
	`start_minute` integer NOT NULL,
	`duration` integer NOT NULL,
	FOREIGN KEY (`organizer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`initials` text NOT NULL,
	`tone` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);