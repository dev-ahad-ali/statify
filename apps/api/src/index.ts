import { httpServerHandler } from "cloudflare:node";
import { createApp } from "./app.js";
import { runtimeEnv } from "./config/env.js";
import { AuditsRepository } from "./features/audits/audits.repository.js";
import { runNightlyPsi } from "./features/audits/audits.service.js";

createApp().listen(8787);
export default httpServerHandler({ port: 8787 });

export async function scheduled(_controller: ScheduledController, _env: Env, ctx: ExecutionContext) {
  if (!runtimeEnv.PSI_API_KEY) {
    console.error("scheduled audits skipped: PSI_API_KEY is not configured");
    return;
  }
  ctx.waitUntil(runNightlyPsi(new AuditsRepository(runtimeEnv.DB), runtimeEnv.PSI_API_KEY));
}
