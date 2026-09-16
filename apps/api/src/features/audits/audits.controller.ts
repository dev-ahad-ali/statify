import type { Request, Response } from "express";
import { runtimeEnv } from "../../config/env.js";
import { failure, success } from "../../lib/response.js";
import { requireUserId } from "../auth/auth.middleware.js";
import { AuditsRepository } from "./audits.repository.js";
import { runFullAudit, serializeAudit } from "./audits.service.js";

const repository = new AuditsRepository(runtimeEnv.DB);
function projectId(req: Request) { const value = req.params.projectId; if (typeof value !== "string") throw new Error("Project id is required"); return value; }

export async function listAuditsController(req: Request, res: Response) {
  const project = await repository.findOwnedProject(projectId(req), requireUserId(req));
  if (!project) return failure(res, "Project not found", 404);
  const parsed = Number(req.query.limit ?? 30);
  const limit = Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), 30) : 30;
  const rows = await repository.listOwned(project.id, requireUserId(req), limit);
  const vitals = await repository.listFieldVitals(project.id, requireUserId(req));
  const field = Object.fromEntries(vitals.results.map((vital) => [vital.name, { count: vital.count, mean: vital.count ? vital.total / vital.count : null }]));
  return success(res, "Audits retrieved", { audits: rows.results.map(serializeAudit), field });
}

export async function runAuditController(req: Request, res: Response) {
  const ownerId = requireUserId(req);
  const project = await repository.findOwnedProject(projectId(req), ownerId);
  if (!project) return failure(res, "Project not found", 404);
  if (!runtimeEnv.PSI_API_KEY) return failure(res, "PageSpeed API is not configured", 503);
  const key = `audit-run:${project.id}`;
  if (await runtimeEnv.CACHE.get(key)) return failure(res, "This project was audited recently", 429);
  await runtimeEnv.CACHE.put(key, "1", { expirationTtl: 600 });
  try { await runFullAudit(repository, project, runtimeEnv.PSI_API_KEY); return success(res, "Audit completed", null, 201); }
  catch (error) { await runtimeEnv.CACHE.delete(key); console.error("manual audit failed", error); return failure(res, "Unable to run audit", 502); }
}
