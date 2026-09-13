import type { Response } from "express";
import { runtimeEnv } from "../../config/env.js";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from "./auth.service.js";

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const secure = runtimeEnv.ENVIRONMENT === "production";
  const suffix = `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  res.append("Set-Cookie", `access_token=${accessToken}; Max-Age=${ACCESS_TOKEN_TTL_SECONDS}; ${suffix}`);
  res.append("Set-Cookie", `refresh_token=${refreshToken}; Max-Age=${REFRESH_TOKEN_TTL_SECONDS}; ${suffix}`);
}
