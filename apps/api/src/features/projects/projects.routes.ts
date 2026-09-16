import { Router, type Router as RouterType } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { createProjectController, deleteProjectController, listProjectsController, rotateApiKeyController, updateProjectController } from "./projects.controller.js";

export const projectsRouter: RouterType = Router();
projectsRouter.use(requireAuth);
projectsRouter.get("/", listProjectsController);
projectsRouter.post("/", createProjectController);
projectsRouter.patch("/:id", updateProjectController);
projectsRouter.delete("/:id", deleteProjectController);
projectsRouter.post("/:id/rotate-key", rotateApiKeyController);
