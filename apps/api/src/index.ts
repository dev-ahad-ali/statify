import { httpServerHandler } from "cloudflare:node";
import { createApp } from "./app.js";
import { runtimeEnv } from "./config/env.js";
import { AuditsRepository } from "./features/audits/audits.repository.js";
import { runNightlyPsi } from "./features/audits/audits.service.js";
import { deleteExpiredEvents } from "./features/retention/retention.service.js";

createApp().listen(8787);
export default httpServerHandler({ port: 8787 });

export async function scheduled(controller: ScheduledController, _env: Env, ctx: ExecutionContext) {
  if (controller.cron === "0 4 * * 0") {
    ctx.waitUntil(deleteExpiredEvents(runtimeEnv.DB).catch((error) => console.error("event retention failed", error)));
    return;
  }
  if (!runtimeEnv.PSI_API_KEY) {
    console.error("scheduled audits skipped: PSI_API_KEY is not configured");
    return;
  }
  ctx.waitUntil(runNightlyPsi(new AuditsRepository(runtimeEnv.DB), runtimeEnv.PSI_API_KEY));
}
