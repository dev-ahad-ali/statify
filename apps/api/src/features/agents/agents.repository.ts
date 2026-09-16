import type { DashboardOptions } from "../dashboard/dashboard.repository.js";

export type AgentsOptions = Pick<DashboardOptions, "range"> & { vendor?: string };

type SummaryRow = { category: string; visits: number };
type ChartRow = { date: string; category: string; visits: number };
type DimensionRow = { dimension: string; visits: number; confidence?: string };

export class AgentsRepository {
  constructor(private readonly db: D1Database) {}

  findOwnedProject(projectId: string, ownerId: string) {
    return this.db.prepare("SELECT id FROM projects WHERE id = ? AND owner_id = ? AND is_active = 1").bind(projectId, ownerId).first<{ id: string }>();
  }

  async getAgents(projectId: string, options: AgentsOptions) {
    const values = [projectId, options.range.from, options.range.to];
    const vendorClause = options.vendor ? " AND vendor = ?" : "";
    const vendorValues = options.vendor ? [...values, options.vendor] : values;
    const eventValues = options.vendor ? [projectId, options.range.from, `${options.range.to}T23:59:59.999Z`, options.vendor] : [projectId, options.range.from, `${options.range.to}T23:59:59.999Z`];
    const [summary, chart, vendors, harnesses, paths] = await Promise.all([
      this.db.prepare(`SELECT category, COALESCE(SUM(visitors), 0) AS visits FROM daily_agents WHERE project_id = ? AND date BETWEEN ? AND ?${vendorClause} GROUP BY category ORDER BY visits DESC`).bind(...vendorValues).all<SummaryRow>(),
      this.db.prepare(`SELECT date, category, COALESCE(SUM(visitors), 0) AS visits FROM daily_agents WHERE project_id = ? AND date BETWEEN ? AND ?${vendorClause} GROUP BY date, category ORDER BY date ASC`).bind(...vendorValues).all<ChartRow>(),
      this.db.prepare(`SELECT vendor AS dimension, COALESCE(SUM(visitors), 0) AS visits, MAX(confidence) AS confidence FROM daily_agents WHERE project_id = ? AND date BETWEEN ? AND ?${vendorClause} AND category != 'human' GROUP BY vendor ORDER BY visits DESC LIMIT 50`).bind(...vendorValues).all<DimensionRow>(),
      this.db.prepare(`SELECT harness AS dimension, COALESCE(SUM(visitors), 0) AS visits FROM daily_agents WHERE project_id = ? AND date BETWEEN ? AND ?${vendorClause} AND category != 'human' GROUP BY harness ORDER BY visits DESC LIMIT 50`).bind(...vendorValues).all<DimensionRow>(),
      this.db.prepare(`SELECT COALESCE(path, 'unknown') AS dimension, COUNT(*) AS visits FROM events WHERE project_id = ? AND type IN ('page_view', 'server_request') AND agent_category != 'human' AND timestamp >= strftime('%s', ?) * 1000 AND timestamp < strftime('%s', ?) * 1000 + 86400000${options.vendor ? " AND agent_vendor = ?" : ""} GROUP BY path ORDER BY visits DESC LIMIT 50`).bind(...eventValues).all<DimensionRow>(),
    ]);
    const byCategory = summary.results;
    const agentVisits = byCategory.filter((row) => row.category !== "human").reduce((sum, row) => sum + Number(row.visits), 0);
    const humanVisits = byCategory.filter((row) => row.category === "human").reduce((sum, row) => sum + Number(row.visits), 0);
    return {
      summary: { agentVisits, humanVisits, totalVisits: agentVisits + humanVisits, agentRatio: agentVisits + humanVisits ? agentVisits / (agentVisits + humanVisits) : 0 },
      chart: chart.results,
      byCategory: byCategory.filter((row) => row.category !== "human").map((row) => ({ dimension: row.category, visits: row.visits })),
      byVendor: vendors.results,
      byHarness: harnesses.results,
      paths: paths.results,
    };
  }
}
