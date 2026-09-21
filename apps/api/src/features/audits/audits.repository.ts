import type { ProjectRow } from "../projects/projects.repository.js";

export type AuditRow = {
  id: string;
  project_id: string;
  url: string;
  ran_at: number;
  performance: number | null;
  accessibility: number | null;
  best_practices: number | null;
  seo: number | null;
  agentic: number | null;
  lcp_ms: number | null;
  inp_ms: number | null;
  cls: number | null;
  raw_json: string | null;
};

export type AuditInsert = Omit<AuditRow, "raw_json"> & { raw_json: string };
export type VitalRow = {
  name: "LCP" | "INP" | "CLS";
  count: number;
  total: number;
};

export class AuditsRepository {
  constructor(private readonly db: D1Database) {}

  listActiveProjects() {
    return this.db
      .prepare(
        "SELECT * FROM projects WHERE is_active = 1 ORDER BY created_at ASC",
      )
      .all<ProjectRow>();
  }

  findOwnedProject(projectId: string, ownerId: string) {
    return this.db
      .prepare(
        "SELECT * FROM projects WHERE id = ? AND owner_id = ? AND is_active = 1",
      )
      .bind(projectId, ownerId)
      .first<ProjectRow>();
  }

  insert(audit: AuditInsert) {
    return this.db
      .prepare(
        "INSERT INTO audits (id, project_id, url, ran_at, performance, accessibility, best_practices, seo, agentic, lcp_ms, inp_ms, cls, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        audit.id,
        audit.project_id,
        audit.url,
        audit.ran_at,
        audit.performance,
        audit.accessibility,
        audit.best_practices,
        audit.seo,
        audit.agentic,
        audit.lcp_ms,
        audit.inp_ms,
        audit.cls,
        audit.raw_json,
      )
      .run();
  }

  listOwned(projectId: string, ownerId: string, limit: number) {
    return this.db
      .prepare(
        "SELECT audits.* FROM audits INNER JOIN projects ON projects.id = audits.project_id WHERE audits.project_id = ? AND projects.owner_id = ? AND projects.is_active = 1 ORDER BY audits.ran_at DESC LIMIT ?",
      )
      .bind(projectId, ownerId, limit)
      .all<AuditRow>();
  }

  listFieldVitals(projectId: string, ownerId: string) {
    return this.db
      .prepare(
        "SELECT daily_vitals.name, SUM(daily_vitals.count) AS count, SUM(daily_vitals.total) AS total FROM daily_vitals INNER JOIN projects ON projects.id = daily_vitals.project_id WHERE daily_vitals.project_id = ? AND projects.owner_id = ? AND projects.is_active = 1 AND daily_vitals.date >= date('now', '-30 days') GROUP BY daily_vitals.name",
      )
      .bind(projectId, ownerId)
      .all<VitalRow>();
  }
}
