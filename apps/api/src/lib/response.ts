import type { Response } from "express";

export function success<T>(res: Response, message: string, data: T, status = 200) {
  return res.status(status).json({ success: true, message, data, error: null });
}

export function failure(res: Response, message: string, status: number, error = message) {
  return res.status(status).json({ success: false, message, data: null, error });
}
