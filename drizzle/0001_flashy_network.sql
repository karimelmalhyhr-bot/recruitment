ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','hr_member','viewer') NOT NULL DEFAULT 'user';
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` int,
	`details` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(80),
	`jobId` int NOT NULL,
	`source` varchar(120),
	`notes` text,
	`status` enum('new','screening','shortlisted','phone','interview','offer','rejected','withdrawn') NOT NULL DEFAULT 'new',
	`privacyAccepted` int NOT NULL DEFAULT 0,
	`resumeKey` varchar(512),
	`resumeFileName` varchar(255),
	`resumeContentType` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `candidates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evaluations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`candidateId` int NOT NULL,
	`interviewId` int,
	`scores` text NOT NULL,
	`strengths` text,
	`concerns` text,
	`recommendation` enum('hire','hold','no_hire') NOT NULL,
	`notes` text,
	`evaluatorId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evaluations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`jobId` int,
	`tokenHash` varchar(128) NOT NULL,
	`createdBy` int NOT NULL,
	`disabledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `integrations_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `interviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`candidateId` int NOT NULL,
	`kind` enum('phone','first','technical','final') NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`timeZone` varchar(80) NOT NULL,
	`participants` text NOT NULL,
	`notes` text,
	`status` enum('scheduled','completed','canceled') NOT NULL DEFAULT 'scheduled',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `interviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`department` varchar(160),
	`location` varchar(160),
	`employmentType` varchar(80),
	`status` enum('open','paused','closed') NOT NULL DEFAULT 'open',
	`ownerName` varchar(255),
	`criteria` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`kind` varchar(80) NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` varchar(500) NOT NULL,
	`entityType` varchar(80),
	`entityId` int,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`question` text NOT NULL,
	`competency` varchar(160) NOT NULL,
	`stage` varchar(80) NOT NULL,
	`jobId` int,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `auditLogs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `audit_user_idx` ON `auditLogs` (`userId`);--> statement-breakpoint
CREATE INDEX `candidates_job_idx` ON `candidates` (`jobId`);--> statement-breakpoint
CREATE INDEX `candidates_status_idx` ON `candidates` (`status`);--> statement-breakpoint
CREATE INDEX `candidates_email_idx` ON `candidates` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `candidates_email_job_unique` ON `candidates` (`email`,`jobId`);--> statement-breakpoint
CREATE INDEX `evaluations_candidate_idx` ON `evaluations` (`candidateId`);--> statement-breakpoint
CREATE INDEX `evaluations_interview_idx` ON `evaluations` (`interviewId`);--> statement-breakpoint
CREATE INDEX `integrations_job_idx` ON `integrations` (`jobId`);--> statement-breakpoint
CREATE INDEX `interviews_candidate_idx` ON `interviews` (`candidateId`);--> statement-breakpoint
CREATE INDEX `interviews_scheduled_idx` ON `interviews` (`scheduledAt`);--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `notifications_unread_idx` ON `notifications` (`userId`,`readAt`);--> statement-breakpoint
CREATE INDEX `questions_job_idx` ON `questions` (`jobId`);
