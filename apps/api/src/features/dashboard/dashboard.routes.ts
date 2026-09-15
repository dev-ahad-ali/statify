import { Router, type Router as RouterType } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { dashboardController } from "./dashboard.controller.js";

export const dashboardRouter: RouterType = Router();
dashboardRouter.use(requireAuth);
dashboardRouter.get("/:projectId", dashboardController);
