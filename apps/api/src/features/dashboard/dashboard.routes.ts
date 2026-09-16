import { Router, type Router as RouterType } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { dashboardController } from "./dashboard.controller.js";
import { agentsController } from "../agents/agents.controller.js";

export const dashboardRouter: RouterType = Router();
dashboardRouter.use(requireAuth);
dashboardRouter.get("/:projectId/agents", agentsController);
dashboardRouter.get("/:projectId", dashboardController);
