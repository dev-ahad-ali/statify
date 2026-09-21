import type { NextFunction, Request, Response } from "express";
import { failure } from "../../lib/response.js";
import { authenticateAccessToken } from "./auth.service.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function readCookie(req: Request, name: string) {
  const cookies = req.headers.cookie?.split(";") ?? [];
  const cookie = cookies.find((value) => value.trim().startsWith(`${name}=`));
  return cookie
    ? decodeURIComponent(cookie.trim().slice(name.length + 1))
    : undefined;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userId = await authenticateAccessToken(
    readCookie(req, "access_token") ?? "",
  );
  if (!userId) return failure(res, "Authentication required", 401);
  req.userId = userId;
  return next();
}

export function requireUserId(req: Request) {
  if (!req.userId) throw new Error("Authenticated user id is missing");
  return req.userId;
}

export { readCookie };
