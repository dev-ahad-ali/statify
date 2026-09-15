import { z } from "zod";
import { DashboardRepository, type DashboardFilters, type DashboardOptions, type DashboardRange } from "./dashboard.repository.js";

const dashboardQuerySchema = z.object({
  range: z.enum(["today", "yesterday", "7d", "30d", "this_month", "12m", "all"]).default("7d"),
  pageView: z.enum(["top", "entry"]).default("top"),
  locationView: z.enum(["country", "region", "city"]).default("country"),
  deviceView: z.enum(["browser", "os", "device"]).default("browser"),
  page: z.string().trim().min(1).optional(),
  referrer: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
  browser: z.string().trim().min(1).optional(),
  os: z.string().trim().min(1).optional(),
  device: z.string().trim().min(1).optional(),
});

export class DashboardValidationError extends Error {}
export class DashboardNotFoundError extends Error {}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function resolveRange(slug: z.infer<typeof dashboardQuerySchema>["range"], now = new Date()): DashboardRange {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let from = today;
  let to = today;
  if (slug === "yesterday") from = to = addDays(today, -1);
  if (slug === "7d") from = addDays(today, -6);
  if (slug === "30d") from = addDays(today, -29);
  if (slug === "this_month") from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  if (slug === "12m") from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1));
  if (slug === "all") from = new Date(Date.UTC(2000, 0, 1));
  const chartFrom = from > addDays(to, -2) ? addDays(to, -2) : from;
  return { from: dateOnly(from), to: dateOnly(to), chartFrom: dateOnly(chartFrom), chartTo: dateOnly(to) };
}

export function parseDashboardQuery(query: Record<string, unknown>, now?: Date): DashboardOptions {
  const parsed = dashboardQuerySchema.safeParse(query);
  if (!parsed.success) throw new DashboardValidationError(parsed.error.issues[0]?.message ?? "Invalid dashboard query");
  const { range, pageView, locationView, deviceView, ...filters } = parsed.data;
  return { range: resolveRange(range, now), pageView, locationView, deviceView, filters: filters as DashboardFilters };
}

export async function getDashboard(repository: DashboardRepository, projectId: string, ownerId: string, options: DashboardOptions) {
  const project = await repository.findOwnedProject(projectId, ownerId);
  if (!project) throw new DashboardNotFoundError("Project not found");
  const hasFilters = Object.values(options.filters).some((value) => value !== undefined);
  const data = hasFilters ? await repository.fromEvents(projectId, options) : await repository.fromRollups(projectId, options);
  return { projectId, range: options.range, views: { pageView: options.pageView, locationView: options.locationView, deviceView: options.deviceView }, filtered: hasFilters, ...data };
}
