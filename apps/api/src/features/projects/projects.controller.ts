import type { Request, Response } from "express";
import { runtimeEnv } from "../../config/env.js";
import { failure, success } from "../../lib/response.js";
import { requireUserId } from "../auth/auth.middleware.js";
import { ProjectsRepository } from "./projects.repository.js";
import { createProject, deleteProject, listProjects, ProjectNotFoundError, ProjectValidationError, rotateApiKey, updateProject } from "./projects.service.js";

const repository = new ProjectsRepository(runtimeEnv.DB);

function routeParam(req: Request, name: string) {
  const value = req.params[name];
  if (typeof value !== "string") throw new ProjectNotFoundError("Project not found");
  return value;
}

function handleError(res: Response, error: unknown) {
  if (error instanceof ProjectValidationError) return failure(res, error.message, 400);
  if (error instanceof ProjectNotFoundError) return failure(res, error.message, 404);
  throw error;
}

export async function listProjectsController(req: Request, res: Response) {
  try { return success(res, "Projects retrieved", await listProjects(repository, requireUserId(req))); } catch (error) { return handleError(res, error); }
}

export async function createProjectController(req: Request, res: Response) {
  try { return success(res, "Project created", await createProject(repository, runtimeEnv.CACHE, requireUserId(req), req.body), 201); } catch (error) { return handleError(res, error); }
}

export async function updateProjectController(req: Request, res: Response) {
  try { return success(res, "Project updated", await updateProject(repository, runtimeEnv.CACHE, routeParam(req, "id"), requireUserId(req), req.body)); } catch (error) { return handleError(res, error); }
}

export async function rotateApiKeyController(req: Request, res: Response) {
  try { return success(res, "API key rotated", await rotateApiKey(repository, runtimeEnv.CACHE, routeParam(req, "id"), requireUserId(req))); } catch (error) { return handleError(res, error); }
}

export async function deleteProjectController(req: Request, res: Response) {
  try { await deleteProject(repository, runtimeEnv.CACHE, routeParam(req, "id"), requireUserId(req)); return success(res, "Project deleted", null); } catch (error) { return handleError(res, error); }
}
