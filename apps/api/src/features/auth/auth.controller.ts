import type { Request, Response } from "express";
import { forgotPasswordSchema, resetPasswordSchema } from "@statify/shared";
import { runtimeEnv } from "../../config/env.js";
import { sha256Hex } from "../../lib/crypto.js";
import { failure, success } from "../../lib/response.js";
import { clearAuthCookies, setAuthCookies } from "./auth.cookies.js";
import {
  AuthConflictError,
  AUTH_ERROR,
  InvalidRefreshTokenError,
  forgotPassword,
  login,
  refresh,
  resetPassword,
  signup,
} from "./auth.service.js";
import { AuthRepository } from "./auth.repository.js";
import { readCookie } from "./auth.middleware.js";
import {
  enforceRateLimit,
  hashedRateLimitKey,
  RateLimitError,
} from "../../lib/rate-limit.js";

const repository = new AuthRepository(runtimeEnv.DB);

export async function signupController(req: Request, res: Response) {
  try {
    const result = await signup(repository, req.body);
    if (result.kind === "invalid")
      return failure(res, "Invalid signup data", 400, result.error);
    setAuthCookies(res, result.result.accessToken, result.result.refreshToken);
    return success(res, "Account created", result.result.user, 201);
  } catch (error) {
    if (error instanceof AuthConflictError)
      return failure(res, error.message, 409);
    throw error;
  }
}

export async function loginController(req: Request, res: Response) {
  try {
    await enforceRateLimit(
      runtimeEnv.CACHE,
      await hashedRateLimitKey("auth-login", clientAddress(req)),
      10,
      60,
    );
  } catch (error) {
    if (error instanceof RateLimitError)
      return failure(res, error.message, 429);
    throw error;
  }
  const result = await login(repository, req.body);
  if (result.kind === "invalid") return failure(res, AUTH_ERROR, 401);
  setAuthCookies(res, result.result.accessToken, result.result.refreshToken);
  return success(res, "Login successful", result.result.user);
}

export async function refreshController(req: Request, res: Response) {
  try {
    const result = await refresh(
      repository,
      readCookie(req, "refresh_token") ?? "",
    );
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return success(res, "Token refreshed", result.user);
  } catch (error) {
    if (error instanceof InvalidRefreshTokenError)
      return failure(res, "Invalid refresh token", 401);
    throw error;
  }
}

export async function logoutController(req: Request, res: Response) {
  const token = readCookie(req, "refresh_token");
  if (token) await repository.deleteRefreshToken(await sha256Hex(token));
  clearAuthCookies(res);
  return success(res, "Logged out", null);
}

export async function forgotController(req: Request, res: Response) {
  try {
    await enforceRateLimit(
      runtimeEnv.CACHE,
      await hashedRateLimitKey("auth-forgot", clientAddress(req)),
      10,
      60,
    );
  } catch (error) {
    if (error instanceof RateLimitError)
      return failure(res, error.message, 429);
    throw error;
  }
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (parsed.success) {
    try {
      await forgotPassword(repository, parsed.data.email);
    } catch (error) {
      console.error("password reset email failed", error);
    }
  }
  return success(
    res,
    "If an account exists, a password reset link has been sent",
    null,
  );
}

function clientAddress(req: Request) {
  return (
    req.header("cf-connecting-ip") ??
    req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.ip ??
    "unknown"
  );
}

export async function resetController(req: Request, res: Response) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success)
    return failure(res, "Invalid or expired reset token", 400);
  const reset = await resetPassword(
    repository,
    parsed.data.token,
    parsed.data.password,
  );
  if (!reset) return failure(res, "Invalid or expired reset token", 400);
  return success(res, "Password reset", null);
}

export async function meController(req: Request, res: Response) {
  const user = req.userId ? await repository.findUserById(req.userId) : null;
  if (!user) return failure(res, "Authentication required", 401);
  return success(res, "Authenticated user", {
    id: user.id,
    email: user.email,
    name: user.name,
  });
}
