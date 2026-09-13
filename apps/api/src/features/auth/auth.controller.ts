import type { Request, Response } from "express";
import { runtimeEnv } from "../../config/env.js";
import { failure, success } from "../../lib/response.js";
import { setAuthCookies } from "./auth.cookies.js";
import { AuthConflictError, AUTH_ERROR, login, signup } from "./auth.service.js";
import { AuthRepository } from "./auth.repository.js";

const repository = new AuthRepository(runtimeEnv.DB);

export async function signupController(req: Request, res: Response) {
  try {
    const result = await signup(repository, req.body);
    if (result.kind === "invalid") return failure(res, "Invalid signup data", 400, result.error);
    setAuthCookies(res, result.result.accessToken, result.result.refreshToken);
    return success(res, "Account created", result.result.user, 201);
  } catch (error) {
    if (error instanceof AuthConflictError) return failure(res, error.message, 409);
    throw error;
  }
}

export async function loginController(req: Request, res: Response) {
  const result = await login(repository, req.body);
  if (result.kind === "invalid") return failure(res, AUTH_ERROR, 401);
  setAuthCookies(res, result.result.accessToken, result.result.refreshToken);
  return success(res, "Login successful", result.result.user);
}
