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
  const url = new URL(
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
  );
  url.searchParams.set("url", `https://${project.domain}`);
  url.searchParams.set("strategy", "mobile");
  for (const category of [
    "PERFORMANCE",
    "ACCESSIBILITY",
    "BEST_PRACTICES",
    "SEO",
  ])
    url.searchParams.append("category", category);
  url.searchParams.set("key", apiKey);
  const response = await fetch(url, {
    headers: { "User-Agent": "Statify/1.0 audit" },
  });
  if (!response.ok) throw new Error(`PageSpeed returned ${response.status}`);
  return (await response.json()) as PsiResponse;
}

export async function runPsiAudit(
  repository: AuditsRepository,
  project: ProjectRow,
  apiKey: string,
  ranAt = Date.now(),
) {
  const psi = await fetchPsi(project, apiKey);
  const categories = psi.lighthouseResult?.categories ?? {};
  const metrics = psi.loadingExperience?.metrics ?? {};
  await repository.insert({
    id: randomId(),
    project_id: project.id,
    url: `https://${project.domain}`,
    ran_at: ranAt,
    performance: score(categories.performance?.score),
    accessibility: score(categories.accessibility?.score),
    best_practices: score(categories["best-practices"]?.score),
    seo: score(categories.seo?.score),
    agentic: null,
    lcp_ms: metrics.LCP?.percentile ?? null,
    inp_ms: metrics.INP?.percentile ?? null,
    cls: metrics.CLS?.percentile ?? null,
    raw_json: JSON.stringify({ psi }),
  });
}

type AgenticCheck = {
  key: string;
  label: string;
  passed: boolean;
  weight: number;
  note: string;
};
type Fetcher = typeof fetch;

async function fetchText(url: string, fetcher: Fetcher, signal: AbortSignal) {
  const response = await fetcher(url, {
    signal,
    headers: { "User-Agent": "Statify/1.0 audit", "Cache-Control": "no-cache" },
  });
  return response.ok ? await response.text() : null;
}

function wordsFromHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[^;]+;/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export async function runAgenticAudit(
  url: string,
  fetcher: Fetcher = fetch,
): Promise<{ score: number; checks: AgenticCheck[] }> {
  const origin = new URL(url).origin;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const [home, robots, llms, sitemap, signatures] = await Promise.all([
      fetchText(url, fetcher, controller.signal),
      fetchText(`${origin}/robots.txt`, fetcher, controller.signal),
      fetchText(`${origin}/llms.txt`, fetcher, controller.signal),
      fetchText(`${origin}/sitemap.xml`, fetcher, controller.signal),
      fetchText(
        `${origin}/.well-known/http-message-signatures-directory`,
        fetcher,
        controller.signal,
      ),
    ]);
    const robotsText = robots?.toLowerCase() ?? "";
    const sitemapReferenced = Boolean(robotsText.match(/^\s*sitemap\s*:/m));
    const blocksAll = /user-agent:\s*\*[^]*?disallow:\s*\/\s*(?:\n|$)/i.test(
      robots ?? "",
    );
    const html = home ?? "";
    const checks: AgenticCheck[] = [
      {
        key: "robots",
        label: "robots.txt permits AI agents",
        passed: Boolean(robots) && !blocksAll,
        weight: 20,
        note: !robots
          ? "robots.txt was not available"
          : blocksAll
            ? "robots.txt blocks all crawlers"
            : "robots.txt is available without a global block",
      },
      {
        key: "llms",
        label: "llms.txt is available",
        passed: Boolean(llms),
        weight: 15,
        note: llms
          ? "llms.txt was found"
          : "Add /llms.txt to describe your content to AI systems",
      },
      {
        key: "sitemap",
        label: "sitemap.xml is available and referenced",
        passed: Boolean(sitemap) && sitemapReferenced,
        weight: 10,
        note: !sitemap
          ? "sitemap.xml was not found"
          : !sitemapReferenced
            ? "robots.txt does not reference the sitemap"
            : "Sitemap is available and referenced",
      },
      {
        key: "structured-data",
        label: "structured data is present",
        passed: /application\/ld\+json|itemscope/i.test(html),
        weight: 15,
        note: /application\/ld\+json|itemscope/i.test(html)
          ? "JSON-LD or microdata was found"
          : "Add JSON-LD or microdata",
      },
      {
        key: "semantic",
        label: "semantic main content and heading exist",
        passed: /<main\b/i.test(html) && /<h1\b/i.test(html),
        weight: 10,
        note:
          /<main\b/i.test(html) && /<h1\b/i.test(html)
            ? "main and h1 elements were found"
            : "Add a main landmark and one primary h1",
      },
      {
        key: "no-js-content",
        label: "meaningful content renders without JavaScript",
        passed: wordsFromHtml(html).length > 200,
        weight: 15,
        note:
          wordsFromHtml(html).length > 200
            ? "More than 200 text words are in the initial HTML"
            : "Initial HTML contains too little readable text",
      },
      {
        key: "web-bot-auth",
        label: "Web Bot Auth support is advertised",
        passed:
          /signature-agent|message-signatures/i.test(html) ||
          Boolean(signatures),
        weight: 5,
        note:
          /signature-agent|message-signatures/i.test(html) || signatures
            ? "A Web Bot Auth hint was found"
            : "Advertise a signature directory or Signature-Agent support",
      },
      {
        key: "metadata",
        label: "title and meta description exist",
        passed:
          /<title\b[^>]*>[^<]+<\/title>/i.test(html) &&
          /<meta\b[^>]*name=["']description["'][^>]*content=["'][^"']+/i.test(
            html,
          ),
        weight: 10,
        note:
          /<title\b[^>]*>[^<]+<\/title>/i.test(html) &&
          /<meta\b[^>]*name=["']description["'][^>]*content=["'][^"']+/i.test(
            html,
          )
            ? "Title and description were found"
            : "Add a descriptive title and meta description",
      },
    ];
    return {
      score: checks
        .filter((check) => check.passed)
        .reduce((sum, check) => sum + check.weight, 0),
      checks,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runFullAudit(
  repository: AuditsRepository,
  project: ProjectRow,
  apiKey: string,
  ranAt = Date.now(),
) {
  const [psi, agentic] = await Promise.all([
    fetchPsi(project, apiKey),
    runAgenticAudit(`https://${project.domain}`),
  ]);
  const categories = psi.lighthouseResult?.categories ?? {};
  const metrics = psi.loadingExperience?.metrics ?? {};
  await repository.insert({
    id: randomId(),
    project_id: project.id,
    url: `https://${project.domain}`,
    ran_at: ranAt,
    performance: score(categories.performance?.score),
    accessibility: score(categories.accessibility?.score),
    best_practices: score(categories["best-practices"]?.score),
    seo: score(categories.seo?.score),
    agentic: agentic.score,
    lcp_ms: metrics.LCP?.percentile ?? null,
    inp_ms: metrics.INP?.percentile ?? null,
    cls: metrics.CLS?.percentile ?? null,
    raw_json: JSON.stringify({ psi, agentic }),
  });
}

export async function runNightlyPsi(
  repository: AuditsRepository,
  apiKey: string,
  log = console,
) {
  const projects = (await repository.listActiveProjects()).results.slice(
    0,
    200,
  );
  for (const [index, project] of projects.entries()) {
    try {
      await runFullAudit(repository, project, apiKey);
    } catch (error) {
      log.error("scheduled audit failed", project.id, error);
    }
    if (index < projects.length - 1)
      await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

export function serializeAudit(row: AuditRow) {
  let raw: unknown = null;
  try {
    raw = row.raw_json ? JSON.parse(row.raw_json) : null;
  } catch {
    raw = null;
  }
  return {
    id: row.id,
    projectId: row.project_id,
    url: row.url,
    ranAt: row.ran_at,
    performance: row.performance,
    accessibility: row.accessibility,
    bestPractices: row.best_practices,
    seo: row.seo,
    agentic: row.agentic,
    lcpMs: row.lcp_ms,
    inpMs: row.inp_ms,
    cls: row.cls,
    raw,
  };
}
export { type ProjectRow };
