import type { Request, Response } from "express";
import { failure, success } from "../../lib/response.js";
import { requireUserId } from "../auth/auth.middleware.js";
import {
  DashboardNotFoundError,
  DashboardValidationError,
  getDashboard,
  parseDashboardQuery,
} from "./dashboard.service.js";
import { DashboardRepository } from "./dashboard.repository.js";
import { runtimeEnv } from "../../config/env.js";

const repository = new DashboardRepository(runtimeEnv.DB);

export async function dashboardController(req: Request, res: Response) {
  try {
    const projectId = req.params.projectId;
    if (typeof projectId !== "string")
      throw new DashboardNotFoundError("Project not found");
    const options = parseDashboardQuery(req.query as Record<string, unknown>);
    return success(
      res,
      "Dashboard retrieved",
      await getDashboard(repository, projectId, requireUserId(req), options),
    );
  } catch (error) {
    if (error instanceof DashboardValidationError)
      return failure(res, error.message, 400);
    if (error instanceof DashboardNotFoundError)
      return failure(res, error.message, 404);
    throw error;
  }
}
