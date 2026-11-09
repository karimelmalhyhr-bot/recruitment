import { COOKIE_NAME } from "@shared/const";
import { and, asc, desc, eq, inArray, like, or } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  candidates,
  evaluations,
  integrations,
  interviews,
  jobs,
  notifications,
  questions,
  users,
} from "../drizzle/schema";
import {
  getDb,
  hashIntegrationToken,
  isDuplicateEntry,
  notifyHrTeam,
  recordAudit,
} from "./db";
import { storageGetSignedUrl, storagePut } from "./storage";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  hrEditorProcedure,
  hrProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import { TRPCError } from "@trpc/server";

const jobStatus = z.enum(["open", "paused", "closed"]);
const candidateStatus = z.enum([
  "new",
  "screening",
  "shortlisted",
  "phone",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
]);
const interviewKind = z.enum(["phone", "first", "technical", "final"]);
const interviewStatus = z.enum(["scheduled", "completed", "canceled"]);
const recommendation = z.enum(["hire", "hold", "no_hire"]);

function jsonValue<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function publicJobInput() {
  return z.object({
    title: z.string().trim().min(1).max(255),
    department: z.string().trim().max(160).optional(),
    location: z.string().trim().max(160).optional(),
    employmentType: z.string().trim().max(80).optional(),
    status: jobStatus.default("open"),
    ownerName: z.string().trim().max(255).optional(),
    criteria: z.string().max(10000).optional(),
  });
}

async function getJobOrThrow(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  id: number
) {
  const result = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  if (!result[0])
    throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
  return result[0];
}

async function getCandidateOrThrow(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  id: number
) {
  const result = await db
    .select({ candidate: candidates, jobTitle: jobs.title })
    .from(candidates)
    .innerJoin(jobs, eq(candidates.jobId, jobs.id))
    .where(eq(candidates.id, id))
    .limit(1);
  if (!result[0])
    throw new TRPCError({ code: "NOT_FOUND", message: "Candidate not found" });
  return { ...result[0].candidate, jobTitle: result[0].jobTitle };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function candidateConflict(): never {
  throw new TRPCError({
    code: "CONFLICT",
    message: "A candidate with this email already applied for this job",
  });
}

async function ensureCandidateEmailAvailable(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  email: string,
  jobId: number
) {
  const existing = await db
    .select({ id: candidates.id })
    .from(candidates)
    .where(and(eq(candidates.email, email), eq(candidates.jobId, jobId)))
    .limit(1);
  if (existing[0]) candidateConflict();
}

function mapInterview(row: typeof interviews.$inferSelect) {
  return {
    ...row,
    participants: jsonValue<string[]>(row.participants, []),
    questionIds: jsonValue<number[]>(row.questionIds ?? "[]", []),
  };
}

function mapEvaluation(row: typeof evaluations.$inferSelect) {
  return {
    ...row,
    scores: jsonValue<
      Array<{ competency: string; score: number; note?: string }>
    >(row.scores, []),
  };
}

const resumeContentTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function safeResumeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "resume";
}

async function storeResume(input: {
  data?: string;
  fileName?: string;
  contentType?: string;
}) {
  if (!input.data) return { key: null, fileName: null, contentType: null };
  if (
    !input.fileName ||
    !input.contentType ||
    !resumeContentTypes.has(input.contentType)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Unsupported resume file type",
    });
  }
  if (
    !/^[A-Za-z0-9+/]+={0,2}$/.test(input.data) ||
    input.data.length > 7_000_000
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid or oversized resume",
    });
  }
  const data = Buffer.from(input.data, "base64");
  if (data.length === 0 || data.length > 5 * 1024 * 1024) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Resume must be at most 5 MB",
    });
  }
  const fileName = safeResumeFileName(input.fileName);
  const uploaded = await storagePut(
    `candidates/${randomBytes(16).toString("hex")}/${fileName}`,
    data,
    input.contentType
  );
  return { key: uploaded.key, fileName, contentType: input.contentType };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  jobs: router({
    list: hrProcedure.query(async () => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database is not available",
        });
      return db.select().from(jobs).orderBy(desc(jobs.createdAt));
    }),
    openings: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database is not available",
        });
      return db
        .select({
          id: jobs.id,
          title: jobs.title,
          department: jobs.department,
          location: jobs.location,
          employmentType: jobs.employmentType,
          status: jobs.status,
        })
        .from(jobs)
        .where(eq(jobs.status, "open"))
        .orderBy(desc(jobs.createdAt));
    }),
    create: hrEditorProcedure
      .input(publicJobInput())
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available",
          });
        const inserted = await db
          .insert(jobs)
          .values({ ...input, createdBy: ctx.user.id });
        const id = Number(inserted[0].insertId);
        const job = await getJobOrThrow(db, id);
        await recordAudit({
          userId: ctx.user.id,
          action: "created",
          entityType: "job",
          entityId: id,
          details: { fields: Object.keys(input) },
        });
        return job;
      }),
    update: hrEditorProcedure
      .input(
        publicJobInput().partial().extend({ id: z.number().int().positive() })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available",
          });
        const existing = await getJobOrThrow(db, input.id);
        const { id, ...changes } = input;
        if (Object.keys(changes).length === 0)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "At least one field is required",
          });
        await db.update(jobs).set(changes).where(eq(jobs.id, id));
        const job = await getJobOrThrow(db, id);
        await recordAudit({
          userId: ctx.user.id,
          action: "updated",
          entityType: "job",
          entityId: id,
          details: {
            fields: Object.keys(changes),
            fromStatus: existing.status,
            toStatus: job.status,
          },
        });
        return job;
      }),
  }),

  candidates: router({
    list: hrProcedure
      .input(
        z
          .object({
            search: z.string().trim().max(120).optional(),
            status: candidateStatus.optional(),
            jobId: z.number().int().positive().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available",
          });
        const filters = [];
        if (input?.search)
          filters.push(
            or(
              like(candidates.name, `%${input.search}%`),
              like(candidates.email, `%${input.search}%`)
            )!
          );
        if (input?.status) filters.push(eq(candidates.status, input.status));
        if (input?.jobId) filters.push(eq(candidates.jobId, input.jobId));
        const rows = await db
          .select({ candidate: candidates, jobTitle: jobs.title })
          .from(candidates)
          .innerJoin(jobs, eq(candidates.jobId, jobs.id))
          .where(filters.length ? and(...filters) : undefined)
          .orderBy(desc(candidates.createdAt));
        return rows.map(row => ({ ...row.candidate, jobTitle: row.jobTitle }));
      }),
    get: hrProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available",
          });
        return getCandidateOrThrow(db, input.id);
      }),
    create: hrEditorProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(255),
          email: z.string().email().max(320),
          phone: z.string().trim().max(80).optional(),
          jobId: z.number().int().positive(),
          source: z.string().trim().max(120).optional(),
          notes: z.string().max(10000).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available",
          });
        await getJobOrThrow(db, input.jobId);
        const email = normalizeEmail(input.email);
        await ensureCandidateEmailAvailable(db, email, input.jobId);
        try {
          const inserted = await db
            .insert(candidates)
            .values({ ...input, email, privacyAccepted: 0 });
          return getCandidateOrThrow(db, Number(inserted[0].insertId));
        } catch (error) {
          if (isDuplicateEntry(error)) candidateConflict();
          throw error;
        }
      }),
    submitApplication: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(255),
          email: z.string().email().max(320),
          phone: z.string().trim().max(80).optional(),
          jobId: z.number().int().positive(),
          source: z.string().trim().max(120).optional(),
          privacyAccepted: z.literal(true),
          resumeData: z.string().optional(),
          resumeFileName: z.string().trim().max(255).optional(),
          resumeContentType: z.string().trim().max(120).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available",
          });
        const job = await getJobOrThrow(db, input.jobId);
        if (job.status !== "open")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Applications are closed for this job",
          });
        const email = normalizeEmail(input.email);
        await ensureCandidateEmailAvailable(db, email, input.jobId);
        const resume = await storeResume({
          data: input.resumeData,
          fileName: input.resumeFileName,
          contentType: input.resumeContentType,
        });
        try {
          const inserted = await db.insert(candidates).values({
            name: input.name,
            email,
            phone: input.phone,
            jobId: input.jobId,
            source: input.source,
            privacyAccepted: 1,
            resumeKey: resume.key,
            resumeFileName: resume.fileName,
            resumeContentType: resume.contentType,
          });
          return { id: Number(inserted[0].insertId), status: "new" as const };
        } catch (error) {
          if (isDuplicateEntry(error)) candidateConflict();
          throw error;
        }
      }),
    updateStatus: hrEditorProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          status: candidateStatus,
          reason: z.string().trim().max(1000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available",
          });
        const existing = await getCandidateOrThrow(db, input.id);
        if (input.status === "rejected" && !input.reason) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A rejection reason is required",
          });
        }
        const changes =
          input.status === "rejected"
            ? { status: input.status, rejectionReason: input.reason! }
            : existing.status === "rejected"
              ? { status: input.status, rejectionReason: null }
              : { status: input.status };
        await db
          .update(candidates)
          .set(changes)
          .where(eq(candidates.id, input.id));
        const updated = await getCandidateOrThrow(db, input.id);
        await recordAudit({
          userId: ctx.user.id,
          action: "status_changed",
          entityType: "candidate",
          entityId: input.id,
          details: {
            from: existing.status,
            to: input.status,
            hasReason: Boolean(input.reason),
          },
        });
        if (existing.status !== input.status)
          await notifyHrTeam({
            kind: "candidate_stage",
            title: "Candidate stage changed",
            message: "A candidate stage was changed.",
            entityType: "candidate",
            entityId: input.id,
          });
        return updated;
      }),
    resumeLink: hrProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available",
          });
        const candidate = await getCandidateOrThrow(db, input.id);
        if (!candidate.resumeKey)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Resume not found",
          });
        const url = await storageGetSignedUrl(candidate.resumeKey);
        return {
          url,
          expiresInSeconds: 3600,
          fileName: candidate.resumeFileName,
          contentType: candidate.resumeContentType,
        };
      }),
  }),

  interviews: router({
    list: hrProcedure.query(async () => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database is not available",
        });
      const rows = await db
        .select({
          interview: interviews,
          candidateName: candidates.name,
          jobTitle: jobs.title,
        })
        .from(interviews)
        .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
        .innerJoin(jobs, eq(candidates.jobId, jobs.id))
        .orderBy(asc(interviews.scheduledAt));
      return rows.map(row => ({
        ...mapInterview(row.interview),
        candidateName: row.candidateName,
        jobTitle: row.jobTitle,
      }));
    }),
    create: hrEditorProcedure
      .input(
        z.object({
          candidateId: z.number().int().positive(),
          kind: interviewKind,
          scheduledAt: z.coerce.date(),
          timeZone: z.string().trim().min(1).max(80),
          participants: z
            .array(z.string().trim().min(1).max(255))
            .min(1)
            .max(50),
          questionIds: z.array(z.number().int().positive()).max(50).default([]),
          notes: z.string().max(10000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available",
          });
        const candidate = await getCandidateOrThrow(db, input.candidateId);
        const questionIds = [...new Set(input.questionIds)];
        if (questionIds.length !== input.questionIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Duplicate interview question",
          });
        }
        if (questionIds.length) {
          const selectedQuestions = await db
            .select({
              id: questions.id,
              jobId: questions.jobId,
              stage: questions.stage,
            })
            .from(questions)
            .where(inArray(questions.id, questionIds));
          const allQuestionsMatch =
            selectedQuestions.length === questionIds.length &&
            selectedQuestions.every(
              question =>
                question.stage === input.kind &&
                (question.jobId === null || question.jobId === candidate.jobId)
            );
          if (!allQuestionsMatch) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Questions must match this interview stage and job",
            });
          }
        }
        const inserted = await db.insert(interviews).values({
          candidateId: input.candidateId,
          kind: input.kind,
          scheduledAt: input.scheduledAt,
          timeZone: input.timeZone,
          participants: JSON.stringify(input.participants),
          questionIds: JSON.stringify(questionIds),
          notes: input.notes,
          createdBy: ctx.user.id,
        });
        const id = Number(inserted[0].insertId);
        await recordAudit({
          userId: ctx.user.id,
          action: "created",
          entityType: "interview",
          entityId: id,
          details: {
            candidateId: input.candidateId,
            kind: input.kind,
            scheduledAt: input.scheduledAt.toISOString(),
          },
        });
        await notifyHrTeam({
          kind: "interview_scheduled",
          title: "Interview scheduled",
          message: "An interview was scheduled.",
          entityType: "interview",
          entityId: id,
        });
        const row = await db
          .select()
          .from(interviews)
          .where(eq(interviews.id, id))
          .limit(1);
        return mapInterview(row[0]!);
      }),
    update: hrEditorProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          status: interviewStatus,
          notes: z.string().max(10000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available",
          });
        const result = await db.transaction(async tx => {
          const old = await tx
            .select()
            .from(interviews)
            .where(eq(interviews.id, input.id))
            .limit(1)
            .for("update");
          if (!old[0])
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Interview not found",
            });
          if (input.status === "completed") {
            const priorEvaluations = await tx
              .select({ id: evaluations.id })
              .from(evaluations)
              .where(eq(evaluations.interviewId, input.id))
              .limit(1);
            if (!priorEvaluations[0]) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Record at least one evaluation before completing the interview",
              });
            }
          }
          const changes: { status: typeof input.status; notes?: string } = {
            status: input.status,
          };
          if (input.notes !== undefined) changes.notes = input.notes;
          await tx
            .update(interviews)
            .set(changes)
            .where(eq(interviews.id, input.id));
          const row = await tx
            .select()
            .from(interviews)
            .where(eq(interviews.id, input.id))
            .limit(1);
          return { previousStatus: old[0].status, interview: row[0]! };
        });
        await recordAudit({
          userId: ctx.user.id,
          action: "updated",
          entityType: "interview",
          entityId: input.id,
          details: {
            fromStatus: result.previousStatus,
            toStatus: input.status,
            notesChanged: input.notes !== undefined,
          },
        });
        return mapInterview(result.interview);
      }),
  }),

  questions: router({
    list: hrProcedure
      .input(
        z.object({ jobId: z.number().int().positive().optional() }).optional()
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available",
          });
        return db
          .select()
          .from(questions)
          .where(input?.jobId ? eq(questions.jobId, input.jobId) : undefined)
          .orderBy(desc(questions.createdAt));
      }),
    create: hrEditorProcedure
      .input(
        z.object({
          question: z.string().trim().min(1).max(5000),
          competency: z.string().trim().min(1).max(160),
          stage: z.string().trim().min(1).max(80),
          jobId: z.number().int().positive().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available",
          });
        if (input.jobId) await getJobOrThrow(db, input.jobId);
        const inserted = await db
          .insert(questions)
          .values({ ...input, createdBy: ctx.user.id });
        const row = await db
          .select()
          .from(questions)
          .where(eq(questions.id, Number(inserted[0].insertId)))
          .limit(1);
        return row[0];
      }),
    delete: hrEditorProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available",
          });
        await db.delete(questions).where(eq(questions.id, input.id));
        return { success: true } as const;
      }),
  }),

  evaluations: router({
    list: hrProcedure.query(async () => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database is not available",
        });
      const rows = await db
        .select({
          evaluation: evaluations,
          candidateName: candidates.name,
          jobTitle: jobs.title,
          interviewKind: interviews.kind,
          interviewScheduledAt: interviews.scheduledAt,
          interviewTimeZone: interviews.timeZone,
        })
        .from(evaluations)
        .innerJoin(candidates, eq(evaluations.candidateId, candidates.id))
        .innerJoin(jobs, eq(candidates.jobId, jobs.id))
        .leftJoin(interviews, eq(evaluations.interviewId, interviews.id))
        .orderBy(desc(evaluations.createdAt));
      return rows.map(row => ({
        ...mapEvaluation(row.evaluation),
        candidateName: row.candidateName,
        jobTitle: row.jobTitle,
        interviewKind: row.interviewKind,
        interviewScheduledAt: row.interviewScheduledAt,
        interviewTimeZone: row.interviewTimeZone,
      }));
    }),
    create: hrEditorProcedure
      .input(
        z.object({
          candidateId: z.number().int().positive(),
          interviewId: z.number().int().positive(),
          scores: z
            .array(
              z.object({
                competency: z.string().trim().min(1).max(160),
                score: z.number().min(0).max(5),
                note: z.string().max(1000).optional(),
              })
            )
            .min(1)
            .max(100),
          strengths: z.string().max(5000).optional(),
          concerns: z.string().max(5000).optional(),
          recommendation,
          notes: z.string().max(10000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available",
          });
        await getCandidateOrThrow(db, input.candidateId);
        const id = await db.transaction(async tx => {
          const interview = await tx
            .select()
            .from(interviews)
            .where(eq(interviews.id, input.interviewId))
            .limit(1)
            .for("update");
          if (!interview[0] || interview[0].candidateId !== input.candidateId)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Interview does not belong to candidate",
            });
          if (interview[0].status === "canceled") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Cannot evaluate a canceled interview",
            });
          }
          const inserted = await tx.insert(evaluations).values({
            candidateId: input.candidateId,
            interviewId: input.interviewId,
            scores: JSON.stringify(input.scores),
            strengths: input.strengths,
            concerns: input.concerns,
            recommendation: input.recommendation,
            notes: input.notes,
            evaluatorId: ctx.user.id,
          });
          return Number(inserted[0].insertId);
        });
        await recordAudit({
          userId: ctx.user.id,
          action: "created",
          entityType: "evaluation",
          entityId: id,
          details: {
            candidateId: input.candidateId,
            interviewId: input.interviewId ?? null,
            scoreCount: input.scores.length,
            recommendation: input.recommendation,
          },
        });
        const row = await db
          .select()
          .from(evaluations)
          .where(eq(evaluations.id, id))
          .limit(1);
        return mapEvaluation(row[0]!);
      }),
  }),

  notifications: router({
    list: hrProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database is not available",
        });
      return db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, ctx.user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(100);
    }),
    markRead: hrEditorProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available",
          });
        await db
          .update(notifications)
          .set({ readAt: new Date() })
          .where(
            and(
              eq(notifications.id, input.id),
              eq(notifications.userId, ctx.user.id)
            )
          );
        return { success: true } as const;
      }),
  }),

  team: router({
    list: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database is not available",
        });
      return db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          lastSignedIn: users.lastSignedIn,
        })
        .from(users)
        .orderBy(asc(users.name), asc(users.email));
    }),
    setRole: adminProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
          role: z.enum(["user", "hr_member", "viewer"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available",
          });
        const existing = await db
          .select({
            id: users.id,
            role: users.role,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);
        if (!existing[0])
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        if (existing[0].role === "admin")
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "The owner admin role cannot be changed",
          });
        await db
          .update(users)
          .set({ role: input.role })
          .where(eq(users.id, input.userId));
        await recordAudit({
          userId: ctx.user.id,
          action: "role_changed",
          entityType: "user",
          entityId: input.userId,
          details: { fromRole: existing[0].role, toRole: input.role },
        });
        const updated = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            lastSignedIn: users.lastSignedIn,
          })
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);
        return updated[0]!;
      }),
  }),

  integrations: router({
    list: hrProcedure.query(async () => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database is not available",
        });
      return db
        .select({
          id: integrations.id,
          name: integrations.name,
          jobId: integrations.jobId,
          disabledAt: integrations.disabledAt,
          createdBy: integrations.createdBy,
          createdAt: integrations.createdAt,
        })
        .from(integrations)
        .orderBy(desc(integrations.createdAt));
    }),
    createWebhook: hrEditorProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(160),
          jobId: z.number().int().positive().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available",
          });
        if (input.jobId) await getJobOrThrow(db, input.jobId);
        const token = randomBytes(32).toString("base64url");
        const inserted = await db.insert(integrations).values({
          name: input.name,
          jobId: input.jobId,
          tokenHash: hashIntegrationToken(token),
          createdBy: ctx.user.id,
        });
        const id = Number(inserted[0].insertId);
        return { id, endpoint: `/api/intake/${id}`, token };
      }),
    disableWebhook: hrEditorProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database is not available",
          });
        await db
          .update(integrations)
          .set({ disabledAt: new Date() })
          .where(eq(integrations.id, input.id));
        return { success: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;
