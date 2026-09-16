import { randomId } from "../../lib/crypto.js";
import type { ProjectRow } from "../projects/projects.repository.js";
import { AuditsRepository, type AuditRow } from "./audits.repository.js";

type PsiResponse = {
  lighthouseResult?: { categories?: Record<string, { score?: number }> };
  loadingExperience?: { metrics?: Record<string, { percentile?: number }> };
};

function score(value: number | undefined) {
  return value === undefined ? null : Math.round(value * 100);
}

async function fetchPsi(project: ProjectRow, apiKey: string) {
  const url = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  url.searchParams.set("url", `https://${project.domain}`);
  url.searchParams.set("strategy", "mobile");
  for (const category of ["PERFORMANCE", "ACCESSIBILITY", "BEST_PRACTICES", "SEO"]) url.searchParams.append("category", category);
  url.searchParams.set("key", apiKey);
  const response = await fetch(url, { headers: { "User-Agent": "Statify/1.0 audit" } });
  if (!response.ok) throw new Error(`PageSpeed returned ${response.status}`);
  return (await response.json()) as PsiResponse;
}

export async function runPsiAudit(repository: AuditsRepository, project: ProjectRow, apiKey: string, ranAt = Date.now()) {
  const psi = await fetchPsi(project, apiKey);
  const categories = psi.lighthouseResult?.categories ?? {};
  const metrics = psi.loadingExperience?.metrics ?? {};
  await repository.insert({
    id: randomId(), project_id: project.id, url: `https://${project.domain}`, ran_at: ranAt,
    performance: score(categories.performance?.score), accessibility: score(categories.accessibility?.score),
    best_practices: score(categories["best-practices"]?.score), seo: score(categories.seo?.score), agentic: null,
    lcp_ms: metrics.LCP?.percentile ?? null, inp_ms: metrics.INP?.percentile ?? null, cls: metrics.CLS?.percentile ?? null,
    raw_json: JSON.stringify({ psi }),
  });
}

export async function runNightlyPsi(repository: AuditsRepository, apiKey: string, log = console) {
  const projects = (await repository.listActiveProjects()).results.slice(0, 200);
  for (const [index, project] of projects.entries()) {
    try { await runPsiAudit(repository, project, apiKey); } catch (error) { log.error("scheduled PageSpeed audit failed", project.id, error); }
    if (index < projects.length - 1) await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

export function serializeAudit(row: AuditRow) {
  let raw: unknown = null;
  try { raw = row.raw_json ? JSON.parse(row.raw_json) : null; } catch { raw = null; }
  return { id: row.id, projectId: row.project_id, url: row.url, ranAt: row.ran_at, performance: row.performance, accessibility: row.accessibility, bestPractices: row.best_practices, seo: row.seo, agentic: row.agentic, lcpMs: row.lcp_ms, inpMs: row.inp_ms, cls: row.cls, raw };
}
export { type ProjectRow };
