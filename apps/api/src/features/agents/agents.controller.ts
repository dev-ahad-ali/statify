import type { Request, Response } from "express";
import { runtimeEnv } from "../../config/env.js";
import { failure, success } from "../../lib/response.js";
import { requireUserId } from "../auth/auth.middleware.js";
import { AgentsRepository } from "./agents.repository.js";
import { AgentsNotFoundError, AgentsValidationError, getAgents, parseAgentsQuery } from "./agents.service.js";

const repository = new AgentsRepository(runtimeEnv.DB);

export async function agentsController(req: Request, res: Response) {
  try {
    const projectId = req.params.projectId;
    if (typeof projectId !== "string") throw new AgentsNotFoundError("Project not found");
    return success(res, "Agent analytics retrieved", await getAgents(repository, projectId, requireUserId(req), parseAgentsQuery(req.query as Record<string, unknown>)));
  } catch (error) {
    if (error instanceof AgentsValidationError) return failure(res, error.message, 400);
    if (error instanceof AgentsNotFoundError) return failure(res, error.message, 404);
    throw error;
  }
}
