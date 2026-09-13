import { Router, type Router as RouterType } from "express";
import { loginController, signupController } from "./auth.controller.js";

export const authRouter: RouterType = Router();
authRouter.post("/signup", signupController);
authRouter.post("/login", loginController);
