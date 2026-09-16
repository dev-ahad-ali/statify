import type { Request, Response } from "express";
import { runtimeEnv } from "../../config/env.js";
import { failure } from "../../lib/response.js";
import { IngestRepository } from "./ingest.repository.js";
import { IngestOriginError, IngestRateLimitError, IngestUnauthorizedError, IngestValidationError, queueIngest, requestCloudflareProperties } from "./ingest.service.js";

const repository = new IngestRepository(runtimeEnv.DB);

export async function ingestController(req: Request, res: Response) {
  try {
    await queueIngest(
      typeof req.body === "string" ? req.body : JSON.stringify(req.body),
      req.header("origin"),
      req.header("user-agent") ?? "unknown",
      { signature: req.header("signature"), "signature-input": req.header("signature-input"), "signature-agent": req.header("signature-agent"), "x-agent-model": req.header("x-agent-model"), "x-statify-original-method": req.header("x-statify-original-method"), "x-statify-original-url": req.header("x-statify-original-url") },
      requestCloudflareProperties(req as { cf?: Record<string, string | undefined> }),
      repository,
    );
    return res.status(202).end();
  } catch (error) {
    if (error instanceof IngestValidationError) return failure(res, error.message, 400, error.message);
    if (error instanceof IngestUnauthorizedError) return failure(res, error.message, 401, error.message);
    if (error instanceof IngestOriginError) return failure(res, error.message, 403, error.message);
    if (error instanceof IngestRateLimitError) return failure(res, error.message, 429, error.message);
    throw error;
  }
}
