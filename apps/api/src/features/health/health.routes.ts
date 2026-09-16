import { Router, type Router as RouterType } from "express";
import { success } from "../../lib/response.js";

export const healthRouter: RouterType = Router();
healthRouter.get("/", (_req, res) => success(res, "API is healthy", { status: "ok" }));
