import type { Request, Response } from "express";
import { runtimeEnv } from "../../config/env.js";
import { failure } from "../../lib/response.js";
import { IngestRepository } from "./ingest.repository.js";
import { IngestOriginError, IngestUnauthorizedError, IngestValidationError, queueIngest, requestCloudflareProperties } from "./ingest.service.js";

const repository = new IngestRepository(runtimeEnv.DB);

export async function ingestController(req: Request, res: Response) {
  try {
    await queueIngest(
      typeof req.body === "string" ? req.body : JSON.stringify(req.body),
      req.header("origin"),
      req.header("user-agent") ?? "unknown",
      requestCloudflareProperties(req as { cf?: Record<string, string | undefined> }),
      repository,
    );
    return res.status(202).end();
  } catch (error) {
    if (error instanceof IngestValidationError) return failure(res, error.message, 400, error.message);
    if (error instanceof IngestUnauthorizedError) return failure(res, error.message, 401, error.message);
    if (error instanceof IngestOriginError) return failure(res, error.message, 403, error.message);
    throw error;
  }
}
