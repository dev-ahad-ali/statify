import { Router, type Router as RouterType } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { listAuditsController, runAuditController } from "./audits.controller.js";

export const auditsRouter: RouterType = Router();
auditsRouter.use(requireAuth);
auditsRouter.get("/:projectId", listAuditsController);
auditsRouter.post("/:projectId/run", runAuditController);
