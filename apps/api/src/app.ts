import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { authRouter } from "./features/auth/auth.routes.js";
import { healthRouter } from "./features/health/health.routes.js";
import { projectsRouter } from "./features/projects/projects.routes.js";
import { ingestRouter } from "./features/ingest/ingest.routes.js";
import { failure } from "./lib/response.js";

export function createApp(): Express {
  const app = express();
  app.use(express.json({ limit: "32kb" }));
  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/projects", projectsRouter);
  app.use("/ingest", ingestRouter);
  app.use((_req, res) => failure(res, "Not found", 404));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("request failed", err);
    return failure(res, "Internal server error", 500);
  });
  return app;
}
