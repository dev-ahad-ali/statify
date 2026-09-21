import { Router, type Router as RouterType } from "express";
import {
  forgotController,
  loginController,
  logoutController,
  meController,
  refreshController,
  resetController,
  signupController,
} from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";

export const authRouter: RouterType = Router();
authRouter.post("/signup", signupController);
authRouter.post("/login", loginController);
authRouter.post("/refresh", refreshController);
authRouter.post("/logout", logoutController);
authRouter.post("/forgot", forgotController);
authRouter.post("/reset", resetController);
authRouter.get("/me", requireAuth, meController);
