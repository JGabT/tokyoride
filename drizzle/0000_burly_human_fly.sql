CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT 'Admin' NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_email_unique` ON `admin_users` (`email`);--> statement-breakpoint
CREATE TABLE `booking_vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`rate_id` text NOT NULL,
	`price_jpy` integer DEFAULT 0 NOT NULL,
	`driver_name` text DEFAULT '' NOT NULL,
	`driver_country` text DEFAULT '' NOT NULL,
	`driver_license` text DEFAULT '' NOT NULL,
	`driver_idp` text DEFAULT '' NOT NULL,
	`driver_dob` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `booking_vehicles_booking_idx` ON `booking_vehicles` (`booking_id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`ref` text NOT NULL,
	`access_token` text NOT NULL,
	`customer_id` text NOT NULL,
	`departure_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_jpy` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'JPY' NOT NULL,
	`hold_expires_at` integer,
	`paid_at` integer,
	`cancelled_at` integer,
	`notes` text DEFAULT '' NOT NULL,
	`pickup` text,
	`dropoff` text,
	`source` text DEFAULT 'web' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_ref_unique` ON `bookings` (`ref`);--> statement-breakpoint
CREATE INDEX `bookings_status_idx` ON `bookings` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `departures` (
	`id` text PRIMARY KEY NOT NULL,
	`tour_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`capacity` integer DEFAULT 4 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `departures_unique` ON `departures` (`tour_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `departures_window_idx` ON `departures` (`starts_at`);--> statement-breakpoint
CREATE TABLE `inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`topic` text DEFAULT 'general' NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `map_features` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_type` text DEFAULT 'tour' NOT NULL,
	`owner_id` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'start' NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`lat` text NOT NULL,
	`lng` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `map_owner_idx` ON `map_features` (`owner_type`,`owner_id`,`sort`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text DEFAULT '' NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text,
	`kind` text NOT NULL,
	`channel` text DEFAULT 'email' NOT NULL,
	`recipient` text DEFAULT '' NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`sent_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_status_idx` ON `notifications` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`provider` text DEFAULT 'airpay' NOT NULL,
	`provider_checkout_id` text DEFAULT '' NOT NULL,
	`provider_txn_id` text DEFAULT '' NOT NULL,
	`amount_jpy` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `payments_booking_idx` ON `payments` (`booking_id`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`number` text NOT NULL,
	`token` text NOT NULL,
	`issued_at` integer NOT NULL,
	`snapshot` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_number_unique` ON `receipts` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_token_unique` ON `receipts` (`token`);--> statement-breakpoint
CREATE TABLE `resource_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`kind` text DEFAULT 'booking' NOT NULL,
	`booking_id` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `blocks_resource_idx` ON `resource_blocks` (`resource_type`,`resource_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `blocks_booking_idx` ON `resource_blocks` (`booking_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tour_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`tour_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`price_jpy` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tour_rates_unique` ON `tour_rates` (`tour_id`,`vehicle_id`);--> statement-breakpoint
CREATE TABLE `tours` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`duration_hours` integer DEFAULT 4 NOT NULL,
	`meeting_label` text DEFAULT '' NOT NULL,
	`hero_image` text,
	`status` text DEFAULT 'active' NOT NULL,
	`featured` integer DEFAULT 0 NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`driver_mode` text DEFAULT 'self' NOT NULL,
	`pickup_dropoff` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tours_status_idx` ON `tours` (`status`,`sort`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`chassis_code` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'car' NOT NULL,
	`seats` integer DEFAULT 2 NOT NULL,
	`luggage` text DEFAULT '' NOT NULL,
	`transmission` text DEFAULT 'Manual' NOT NULL,
	`engine_code` text DEFAULT '' NOT NULL,
	`drivetrain` text DEFAULT '' NOT NULL,
	`photo` text,
	`blurb` text DEFAULT '' NOT NULL,
	`specs` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `vehicles_active_idx` ON `vehicles` (`active`,`sort`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text DEFAULT 'airpay' NOT NULL,
	`event_id` text NOT NULL,
	`type` text DEFAULT '' NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`processed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_unique` ON `webhook_events` (`provider`,`event_id`);