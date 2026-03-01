CREATE TABLE `portfolio_stocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolioId` varchar(32) NOT NULL,
	`stockId` varchar(64) NOT NULL,
	`allocationPct` double NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portfolio_stocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolios` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`totalCapital` double NOT NULL DEFAULT 100000,
	`allocationMode` enum('percentage','dollar') NOT NULL DEFAULT 'percentage',
	`cashPct` double NOT NULL DEFAULT 100,
	`projectionYears` int NOT NULL DEFAULT 5,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_projections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stockId` varchar(64) NOT NULL,
	`projectionsJson` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_projections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`userId` int NOT NULL,
	`activePortfolioId` varchar(32),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_settings_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `portfolio_stocks` ADD CONSTRAINT `portfolio_stocks_portfolioId_portfolios_id_fk` FOREIGN KEY (`portfolioId`) REFERENCES `portfolios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portfolios` ADD CONSTRAINT `portfolios_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_projections` ADD CONSTRAINT `stock_projections_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_settings` ADD CONSTRAINT `user_settings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;