import express, { Router, type Router as RouterType } from "express";
import { ingestController } from "./ingest.controller.js";

export const ingestRouter: RouterType = Router();
ingestRouter.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
});
ingestRouter.use(express.text({ type: ["text/plain", "application/json"], limit: "256kb" }));
ingestRouter.post("/", ingestController);
