import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "hr_member", "viewer"])
    .default("user")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const jobs = mysqlTable(
  "jobs",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    department: varchar("department", { length: 160 }),
    location: varchar("location", { length: 160 }),
    employmentType: varchar("employmentType", { length: 80 }),
    status: mysqlEnum("status", ["open", "paused", "closed"])
      .default("open")
      .notNull(),
    ownerName: varchar("ownerName", { length: 255 }),
    criteria: text("criteria"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    statusIdx: index("jobs_status_idx").on(table.status),
  })
);

export const candidates = mysqlTable(
  "candidates",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 80 }),
    jobId: int("jobId").notNull(),
    source: varchar("source", { length: 120 }),
    notes: text("notes"),
    rejectionReason: text("rejectionReason"),
    status: mysqlEnum("status", [
      "new",
      "screening",
      "shortlisted",
      "phone",
      "interview",
      "offer",
      "rejected",
      "withdrawn",
    ])
      .default("new")
      .notNull(),
    privacyAccepted: int("privacyAccepted").default(0).notNull(),
    resumeKey: varchar("resumeKey", { length: 512 }),
    resumeFileName: varchar("resumeFileName", { length: 255 }),
    resumeContentType: varchar("resumeContentType", { length: 120 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    jobIdx: index("candidates_job_idx").on(table.jobId),
    statusIdx: index("candidates_status_idx").on(table.status),
    emailIdx: index("candidates_email_idx").on(table.email),
    emailJobUniqueIdx: uniqueIndex("candidates_email_job_unique").on(
      table.email,
      table.jobId
    ),
  })
);

export const interviews = mysqlTable(
  "interviews",
  {
    id: int("id").autoincrement().primaryKey(),
    candidateId: int("candidateId").notNull(),
    kind: mysqlEnum("kind", ["phone", "first", "technical", "final"]).notNull(),
    scheduledAt: timestamp("scheduledAt").notNull(),
    timeZone: varchar("timeZone", { length: 80 }).notNull(),
    participants: text("participants").notNull(),
    questionIds: text("questionIds"),
    notes: text("notes"),
    status: mysqlEnum("status", ["scheduled", "completed", "canceled"])
      .default("scheduled")
      .notNull(),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    candidateIdx: index("interviews_candidate_idx").on(table.candidateId),
    scheduledIdx: index("interviews_scheduled_idx").on(table.scheduledAt),
  })
);

export const questions = mysqlTable(
  "questions",
  {
    id: int("id").autoincrement().primaryKey(),
    question: text("question").notNull(),
    competency: varchar("competency", { length: 160 }).notNull(),
    stage: varchar("stage", { length: 80 }).notNull(),
    jobId: int("jobId"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    jobIdx: index("questions_job_idx").on(table.jobId),
  })
);

export const evaluations = mysqlTable(
  "evaluations",
  {
    id: int("id").autoincrement().primaryKey(),
    candidateId: int("candidateId").notNull(),
    interviewId: int("interviewId"),
    scores: text("scores").notNull(),
    strengths: text("strengths"),
    concerns: text("concerns"),
    recommendation: mysqlEnum("recommendation", [
      "hire",
      "hold",
      "no_hire",
    ]).notNull(),
    notes: text("notes"),
    evaluatorId: int("evaluatorId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    candidateIdx: index("evaluations_candidate_idx").on(table.candidateId),
    interviewIdx: index("evaluations_interview_idx").on(table.interviewId),
  })
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    kind: varchar("kind", { length: 80 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: varchar("message", { length: 500 }).notNull(),
    entityType: varchar("entityType", { length: 80 }),
    entityId: int("entityId"),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    userIdx: index("notifications_user_idx").on(table.userId),
    unreadIdx: index("notifications_unread_idx").on(table.userId, table.readAt),
  })
);

export const integrations = mysqlTable(
  "integrations",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    jobId: int("jobId"),
    tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
    createdBy: int("createdBy").notNull(),
    disabledAt: timestamp("disabledAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    jobIdx: index("integrations_job_idx").on(table.jobId),
  })
);

export const auditLogs = mysqlTable(
  "auditLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId"),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entityType", { length: 80 }).notNull(),
    entityId: int("entityId"),
    details: text("details").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    entityIdx: index("audit_entity_idx").on(table.entityType, table.entityId),
    userIdx: index("audit_user_idx").on(table.userId),
  })
);

export type Job = typeof jobs.$inferSelect;
export type Candidate = typeof candidates.$inferSelect;
export type Interview = typeof interviews.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Evaluation = typeof evaluations.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
