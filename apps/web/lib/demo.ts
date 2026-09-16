import { faker } from "@faker-js/faker";
import type { AgentsData, DashboardData } from "./dashboard";
import type { WebProject } from "./projects";

export const demoProject: WebProject = {
  id: "demo-project",
  name: "Acme Docs",
  domain: "acme.example",
  api_key: "sf_demo_public_key",
  allowed_domains: [],
};

export type DemoAudit = { date: string; performance: number; accessibility: number; bestPractices: number; seo: number; agentic: number };
export type DemoAgentVisit = { date: string; vendor: string; category: string; visits: number };

function seededData() {
  faker.seed(250925);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const chart = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (29 - index));
    const pageviews = faker.number.int({ min: 420, max: 2_400 });
    return { date: date.toISOString().slice(0, 10), visitors: Math.round(pageviews * faker.number.float({ min: 0.52, max: 0.76 })), pageviews };
  });
  const pages = ["/", "/docs/getting-started", "/docs/installation", "/pricing", "/blog/edge-analytics"].map((dimension, index) => ({ dimension, views: 6_400 - index * 830 + faker.number.int({ min: 0, max: 220 }) }));
  const referrers = [{ dimension: "unknown", views: 3_180 }, { dimension: "https://google.com", views: 2_740 }, { dimension: "https://github.com", views: 1_890 }, { dimension: "https://news.ycombinator.com", views: 860 }];
  const countries = [{ dimension: "US", views: 5_820 }, { dimension: "GB", views: 2_130 }, { dimension: "DE", views: 1_480 }, { dimension: "BD", views: 1_060 }, { dimension: "CA", views: 920 }];
  const regions = [{ dimension: "California", views: 2_240 }, { dimension: "England", views: 1_330 }, { dimension: "Dhaka", views: 980 }, { dimension: "Berlin", views: 710 }];
  const cities = [{ dimension: "San Francisco", views: 1_880 }, { dimension: "London", views: 1_210 }, { dimension: "Dhaka", views: 980 }, { dimension: "Berlin", views: 710 }];
  const browsers = [{ dimension: "Chrome", views: 5_910 }, { dimension: "Safari", views: 2_860 }, { dimension: "Firefox", views: 1_190 }, { dimension: "Edge", views: 760 }];
  const os = [{ dimension: "macOS", views: 3_920 }, { dimension: "Windows", views: 3_520 }, { dimension: "iOS", views: 1_840 }, { dimension: "Android", views: 1_460 }];
  const devices = [{ dimension: "desktop", views: 6_830 }, { dimension: "mobile", views: 3_450 }, { dimension: "tablet", views: 460 }];
  const audits = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - index * 5);
    return { date: date.toISOString().slice(0, 10), performance: faker.number.int({ min: 82, max: 98 }), accessibility: faker.number.int({ min: 88, max: 100 }), bestPractices: faker.number.int({ min: 84, max: 99 }), seo: faker.number.int({ min: 90, max: 100 }), agentic: faker.number.int({ min: 68, max: 94 }) };
  });
  const agentVisits = ["OpenAI", "Anthropic", "Perplexity", "Google"].flatMap((vendor) => chart.slice(-7, -3).map((point) => ({ date: point.date, vendor, category: "browsing agent", visits: faker.number.int({ min: 12, max: 86 }) })));
  return { chart, pages, referrers, countries, regions, cities, browsers, os, devices, audits, agentVisits };
}

const data = seededData();

function daysForRange(range: string) {
  if (range === "today") return 1;
  if (range === "yesterday") return 1;
  if (range === "7d") return 7;
  if (range === "30d" || range === "all") return 30;
  if (range === "12m") return 30;
  return new Date().getUTCDate();
}

function scaleRows(rows: Array<{ dimension: string; views: number }>, filter: string | undefined) {
  if (!filter) return rows;
  return rows.filter((row) => row.dimension.toLowerCase() === filter.toLowerCase());
}

export function getDemoDashboard(params: { range: string; pageView: DashboardData["views"]["pageView"]; locationView: DashboardData["views"]["locationView"]; deviceView: DashboardData["views"]["deviceView"]; page?: string; referrer?: string; country?: string; browser?: string; os?: string; device?: string }): DashboardData {
  const chart = data.chart.slice(-daysForRange(params.range));
  const filtered = Boolean(params.page || params.referrer || params.country || params.browser || params.os || params.device);
  const multiplier = filtered ? 0.22 : 1;
  const selectedChart = chart.map((point) => ({ ...point, visitors: Math.round(point.visitors * multiplier), pageviews: Math.round(point.pageviews * multiplier) }));
  const locationRows = params.locationView === "country" ? data.countries : params.locationView === "region" ? data.regions : data.cities;
  const deviceRows = params.deviceView === "browser" ? data.browsers : params.deviceView === "os" ? data.os : data.devices;
  const pages = scaleRows(data.pages, params.page);
  const referrers = scaleRows(data.referrers, params.referrer);
  const locations = scaleRows(locationRows, params.country);
  const devices = scaleRows(deviceRows, params[params.deviceView]);
  return {
    projectId: demoProject.id,
    range: { from: selectedChart[0]?.date ?? data.chart[0]!.date, to: selectedChart.at(-1)?.date ?? data.chart.at(-1)!.date, chartFrom: selectedChart[0]?.date ?? data.chart[0]!.date, chartTo: selectedChart.at(-1)?.date ?? data.chart.at(-1)!.date },
    views: { pageView: params.pageView, locationView: params.locationView, deviceView: params.deviceView },
    filtered,
    summary: { pageviews: selectedChart.reduce((sum, point) => sum + point.pageviews, 0), visitors: selectedChart.reduce((sum, point) => sum + point.visitors, 0), sessions: Math.round(selectedChart.reduce((sum, point) => sum + point.visitors, 0) * 1.18) },
    chart: selectedChart,
    pages: params.pageView === "entry" ? pages.map((row) => ({ ...row, views: Math.round(row.views * 0.64) })) : pages,
    referrers,
    locations,
    devices,
  };
}

export const demoAuditHistory = data.audits;
export const demoAgentVisits = data.agentVisits;

export function getDemoAgents(range: string, vendor?: string): AgentsData {
  const rows = demoAgentVisits.filter((row) => !vendor || row.vendor === vendor);
  const byVendor = ["OpenAI", "Anthropic", "Perplexity", "Google"].map((dimension, index) => ({ dimension, visits: rows.filter((row) => row.vendor === dimension).reduce((sum, row) => sum + row.visits, 0), confidence: index < 2 ? "0.9" : "0.8" })).filter((row) => row.visits > 0);
  const byHarness = [{ dimension: "browser-use", visits: 122 }, { dimension: "ChatGPT", visits: 98 }, { dimension: "Claude", visits: 83 }, { dimension: "Perplexity", visits: 54 }];
  const paths = [{ dimension: "/docs/getting-started", visits: 186 }, { dimension: "/docs/installation", visits: 141 }, { dimension: "/pricing", visits: 74 }, { dimension: "/", visits: 42 }];
  const chart = rows.reduce<Array<{ date: string; category: string; visits: number }>>((result, row) => {
    const existing = result.find((item) => item.date === row.date && item.category === row.category);
    if (existing) existing.visits += row.visits;
    else result.push({ date: row.date, category: row.category, visits: row.visits });
    return result;
  }, []);
  const agentVisits = rows.reduce((sum, row) => sum + row.visits, 0);
  const humanVisits = 8_420;
  const days = range === "today" || range === "yesterday" ? 1 : range === "7d" ? 7 : 30;
  return { projectId: demoProject.id, range: { from: chart[Math.max(0, chart.length - days)]?.date ?? chart[0]?.date ?? new Date().toISOString().slice(0, 10), to: chart.at(-1)?.date ?? new Date().toISOString().slice(0, 10), chartFrom: chart[Math.max(0, chart.length - days)]?.date ?? chart[0]?.date ?? new Date().toISOString().slice(0, 10), chartTo: chart.at(-1)?.date ?? new Date().toISOString().slice(0, 10) }, vendor: vendor ?? null, summary: { agentVisits, humanVisits, totalVisits: agentVisits + humanVisits, agentRatio: agentVisits / (agentVisits + humanVisits) }, chart: chart.slice(-days), byCategory: [{ dimension: "crawler", visits: Math.round(agentVisits * 0.62) }, { dimension: "agent", visits: Math.round(agentVisits * 0.3) }, { dimension: "automation", visits: Math.round(agentVisits * 0.08) }], byVendor, byHarness, paths };
}
