import type { RequestHandler } from "express";
import { sendServerRequest, type ServerSdkOptions } from "./shared.js";

export function statify(options: ServerSdkOptions): RequestHandler {
  return (req, res, next) => {
    res.on("finish", () => {
      void sendServerRequest(options, {
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip,
        getHeader: (name) => req.get(name) ?? undefined,
      });
    });
    next();
  };
}
