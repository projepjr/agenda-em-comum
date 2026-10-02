DELETE FROM `availability`
WHERE `id` NOT IN (
  SELECT MIN(`id`)
  FROM `availability`
  GROUP BY `user_id`, `date`, `start_minute`, `end_minute`
);
--> statement-breakpoint
CREATE UNIQUE INDEX `availability_unique` ON `availability` (`user_id`,`date`,`start_minute`,`end_minute`);
