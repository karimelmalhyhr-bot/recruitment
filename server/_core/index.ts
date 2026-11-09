import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { and, eq } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { candidates, integrations, jobs } from "../../drizzle/schema";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { getDb, hashIntegrationToken, isDuplicateEntry } from "../db";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

const intakeRateBuckets = new Map<
  string,
  { windowStartedAt: number; count: number }
>();
const INTAKE_RATE_WINDOW_MS = 60_000;
const MAX_INTAKE_REQUESTS_PER_WINDOW = 120;
const MAX_TRACKED_INTAKE_BUCKETS = 5000;
let lastIntakeRatePrune = 0;

function intakeRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  if (now - lastIntakeRatePrune >= INTAKE_RATE_WINDOW_MS) {
    for (const [key, bucket] of intakeRateBuckets) {
      if (now - bucket.windowStartedAt >= INTAKE_RATE_WINDOW_MS)
        intakeRateBuckets.delete(key);
    }
    lastIntakeRatePrune = now;
  }

  const key = `${req.socket.remoteAddress ?? "unknown"}:${req.params.id ?? "unknown"}`;
  let bucket = intakeRateBuckets.get(key);
  if (!bucket || now - bucket.windowStartedAt >= INTAKE_RATE_WINDOW_MS) {
    if (!bucket && intakeRateBuckets.size >= MAX_TRACKED_INTAKE_BUCKETS) {
      res.status(429).set("Retry-After", "60").json({ error: "Too many requests" });
      return;
    }
    bucket = { windowStartedAt: now, count: 0 };
    intakeRateBuckets.set(key, bucket);
  }

  if (bucket.count >= MAX_INTAKE_REQUESTS_PER_WINDOW) {
    res.status(429).set("Retry-After", "60").json({ error: "Too many requests" });
    return;
  }
  bucket.count += 1;
  next();
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(
    "/api/intake/:id",
    express.json({ limit: "64kb" }),
    express.urlencoded({ limit: "64kb", extended: true })
  );
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/platform/config.js", (_req, res) => {
    res
      .set("Cache-Control", "no-store")
      .type("application/javascript")
      .send(publicPlatformScript());
  });
  const intakeSchema = z.object({
    name: z.string().trim().min(1).max(255),
    email: z.string().email().max(320),
    phone: z.string().trim().max(80).optional(),
    jobId: z.number().int().positive().optional(),
    source: z.string().trim().max(120).optional(),
    privacyAccepted: z.literal(true),
  });
  app.post("/api/intake/:id", intakeRateLimit, async (req, res) => {
    try {
      const integrationId = Number(req.params.id);
      const suppliedToken = req.header("X-HR-Integration-Token");
      if (
        !Number.isInteger(integrationId) ||
        integrationId < 1 ||
        !suppliedToken
      ) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const db = await getDb();
      if (!db) {
        res.status(503).json({ error: "Database unavailable" });
        return;
      }
      const integrationRows = await db
        .select()
        .from(integrations)
        .where(eq(integrations.id, integrationId))
        .limit(1);
      const integration = integrationRows[0];
      if (!integration || integration.disabledAt) {
        res.status(404).json({ error: "Integration not found" });
        return;
      }
      const actualHash = Buffer.from(
        hashIntegrationToken(suppliedToken),
        "utf8"
      );
      const expectedHash = Buffer.from(integration.tokenHash, "utf8");
      if (
        actualHash.length !== expectedHash.length ||
        !timingSafeEqual(actualHash, expectedHash)
      ) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const payload = intakeSchema.parse(req.body);
      if (
        integration.jobId &&
        payload.jobId &&
        integration.jobId !== payload.jobId
      ) {
        res.status(400).json({ error: "jobId does not match integration" });
        return;
      }
      const jobId = integration.jobId ?? payload.jobId;
      if (!jobId) {
        res.status(400).json({ error: "jobId is required" });
        return;
      }
      const normalizedEmail = payload.email.trim().toLowerCase();
      const duplicate = await db
        .select({ id: candidates.id })
        .from(candidates)
        .where(
          and(
            eq(candidates.email, normalizedEmail),
            eq(candidates.jobId, jobId)
          )
        )
        .limit(1);
      if (duplicate[0]) {
        res
          .status(409)
          .json({
            error: "A candidate with this email already applied for this job",
          });
        return;
      }
      const jobRows = await db
        .select({ id: jobs.id, status: jobs.status })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);
      if (!jobRows[0] || jobRows[0].status !== "open") {
        res.status(400).json({ error: "Job is not open" });
        return;
      }
      const inserted = await db.insert(candidates).values({
        name: payload.name,
        email: normalizedEmail,
        phone: payload.phone,
        jobId,
        source: payload.source ?? `webhook:${integrationId}`,
        privacyAccepted: 1,
      });
      res.status(201).json({ id: Number(inserted[0].insertId), status: "new" });
    } catch (error) {
      if (isDuplicateEntry(error)) {
        res
          .status(409)
          .json({
            error: "A candidate with this email already applied for this job",
          });
        return;
      }
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid intake payload" });
        return;
      }
      console.error(
        "[Intake] Request failed:",
        error instanceof Error ? error.message : "unknown error"
      );
      res.status(500).json({ error: "Unable to process intake" });
    }
  });
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  server.on("error", error => {
    console.error("Server failed:", error.message);
    process.exit(1);
  });
  server.listen(port, "0.0.0.0", () =>
    console.log(`Server listening on port ${port}`)
  );
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});
