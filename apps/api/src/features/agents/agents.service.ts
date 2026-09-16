import { z } from "zod";
import { AgentsRepository, type AgentsOptions } from "./agents.repository.js";
import { resolveDashboardRange } from "../dashboard/dashboard.service.js";

const agentsQuerySchema = z.object({
  range: z.enum(["today", "yesterday", "7d", "30d", "this_month", "12m", "all"]).default("7d"),
  vendor: z.string().trim().min(1).optional(),
});

export class AgentsValidationError extends Error {}
export class AgentsNotFoundError extends Error {}

export function parseAgentsQuery(query: Record<string, unknown>): AgentsOptions {
  const parsed = agentsQuerySchema.safeParse(query);
  if (!parsed.success) throw new AgentsValidationError(parsed.error.issues[0]?.message ?? "Invalid agents query");
  return { range: resolveDashboardRange(parsed.data.range), vendor: parsed.data.vendor };
}

export async function getAgents(repository: AgentsRepository, projectId: string, ownerId: string, options: AgentsOptions) {
  if (!await repository.findOwnedProject(projectId, ownerId)) throw new AgentsNotFoundError("Project not found");
  return { projectId, range: options.range, vendor: options.vendor ?? null, ...(await repository.getAgents(projectId, options)) };
}
