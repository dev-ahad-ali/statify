"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, PolarAngleAxis, RadialBar, RadialBarChart, XAxis } from "recharts";
import { ArrowLeft, Check, Gauge, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useDemo } from "@/components/dashboard/demo-context";
import { demoAuditHistory, demoProject } from "@/lib/demo";
import { getProjects, type WebProject } from "@/lib/projects";
import { getAudits, runAudit, type Audit, type AuditCheck } from "@/lib/audits";

const chartConfig = { performance: { label: "Performance", color: "var(--color-chart-1)" }, accessibility: { label: "Accessibility", color: "var(--color-chart-2)" }, agentic: { label: "Agentic", color: "var(--color-chart-3)" } } satisfies ChartConfig;

function demoAudits(): Audit[] {
  return demoAuditHistory.map((item, index) => ({ id: `demo-${index}`, projectId: demoProject.id, url: `https://${demoProject.domain}`, ranAt: Date.now() - index * 5 * 86400000, performance: item.performance, accessibility: item.accessibility, bestPractices: item.bestPractices, seo: item.seo, agentic: item.agentic, lcpMs: 1_200 + index * 130, inpMs: 100 + index * 12, cls: 0.04 + index * 0.01, raw: { agentic: { checks: demoChecks() } } }));
}
function demoChecks(): AuditCheck[] { return [{ key: "robots", label: "robots.txt permits AI agents", passed: true, weight: 20, note: "robots.txt is available without a global block" }, { key: "llms", label: "llms.txt is available", passed: true, weight: 15, note: "llms.txt was found" }, { key: "sitemap", label: "sitemap.xml is available and referenced", passed: true, weight: 10, note: "Sitemap is available and referenced" }, { key: "structured-data", label: "structured data is present", passed: true, weight: 15, note: "JSON-LD was found" }, { key: "semantic", label: "semantic main content and heading exist", passed: true, weight: 10, note: "main and h1 elements were found" }, { key: "no-js-content", label: "meaningful content renders without JavaScript", passed: false, weight: 15, note: "Initial HTML contains too little readable text" }]; }

function scoreColor(score: number | null) { return score === null ? "var(--color-muted)" : score >= 90 ? "var(--color-chart-2)" : score >= 50 ? "var(--color-chart-1)" : "var(--color-destructive)"; }
function GaugeCard({ label, value }: { label: string; value: number | null }) { const score = value ?? 0; return <Card><CardHeader className="pb-0"><CardDescription>{label}</CardDescription></CardHeader><CardContent><div className="relative mx-auto h-36 w-36"><ChartContainer config={{ score: { label, color: scoreColor(value) } }} className="h-full w-full"><RadialBarChart data={[{ score, fill: scoreColor(value) }]} innerRadius="70%" outerRadius="100%" startAngle={90} endAngle={-270} barSize={13}><PolarAngleAxis type="number" domain={[0, 100]} tick={false} /><RadialBar background dataKey="score" cornerRadius={8} /></RadialBarChart></ChartContainer><span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold tabular-nums">{value ?? "—"}</span></div></CardContent></Card>; }

function fieldStatus(label: string, value: number | null, good: number, unit: string) { const okay = value !== null && value <= good; return <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span>{label}</span><span className={value === null ? "text-muted-foreground" : okay ? "text-emerald-600" : "text-orange-600"}>{value === null ? "No field data" : `${value}${unit}`}</span></div>; }

export function AuditsClient({ demo: demoProp }: { demo?: boolean } = {}) {
  const demo = demoProp ?? useDemo();
  const [projects, setProjects] = useState<WebProject[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const selected = demo ? demoProject : projects.find((project) => project.id === projectId) ?? projects[0] ?? null;

  useEffect(() => { if (demo) { setProjects([demoProject]); setAudits(demoAudits()); setLoading(false); return; } void getProjects().then((result) => { if (result.error || !result.data) setError(result.error ?? "Unable to load projects"); else { setProjects(result.data); setProjectId(result.data[0]?.id ?? null); } setLoading(false); }); }, [demo]);
  const load = useCallback(async () => { if (!selected || demo) return; setError(null); const result = await getAudits(selected.id); if (result.error || !result.data) setError(result.error ?? "Unable to load audits"); else setAudits(result.data); }, [demo, selected]);
  useEffect(() => { void load(); }, [load]);
  const latest = audits[0] ?? null;
  const chartData = useMemo(() => [...audits].reverse().map((audit) => ({ date: new Date(audit.ranAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }), performance: audit.performance, accessibility: audit.accessibility, agentic: audit.agentic })), [audits]);
  async function handleRun() { if (!selected || demo) { toast("Not available in demo"); return; } setRunning(true); const result = await runAudit(selected.id); setRunning(false); if (result.error) { toast.error(result.error); if (result.status === 429) setCooldownUntil(Date.now() + 600000); } else { toast.success("Audit completed"); setCooldownUntil(Date.now() + 600000); await load(); } }
  if (loading) return <div className="h-96 animate-pulse rounded-xl bg-muted" />;
  if (error) return <Card><CardHeader><CardTitle>We could not load audits</CardTitle><CardDescription>{error}</CardDescription></CardHeader><CardContent><Button variant="outline" onClick={() => void load()}><RefreshCw /> Try again</Button></CardContent></Card>;
  if (!selected) return <Card><CardHeader><CardTitle>No project selected</CardTitle><CardDescription>Create a project before opening audits.</CardDescription></CardHeader></Card>;
  const remaining = Math.max(0, cooldownUntil - Date.now());
  const checks = latest?.raw?.agentic?.checks ?? [];
  return <div className="space-y-6">
    <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between"><div><Button variant="ghost" size="sm" asChild><Link href={demo ? "/demo" : `/dashboard?project=${encodeURIComponent(selected.id)}`}><ArrowLeft /> Dashboard</Link></Button><div className="mt-2 flex items-center gap-2"><Gauge className="size-5" /><div><p className="text-sm text-muted-foreground">Site audits</p><h1 className="text-2xl font-semibold tracking-tight">{selected.name}</h1></div></div></div><div className="flex gap-2">{projects.length > 1 && <select aria-label="Project" value={selected.id} onChange={(event) => setProjectId(event.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>}<Button onClick={() => void handleRun()} disabled={running || remaining > 0}>{running ? "Running..." : remaining > 0 ? "Available in 10 min" : "Run now"}</Button></div></header>
    {!latest ? <Card><CardHeader><CardTitle>No audits yet</CardTitle><CardDescription>Run an audit to see Lighthouse and agentic-browsing scores.</CardDescription></CardHeader></Card> : <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><GaugeCard label="Performance" value={latest.performance} /><GaugeCard label="Accessibility" value={latest.accessibility} /><GaugeCard label="Best practices" value={latest.bestPractices} /><GaugeCard label="SEO" value={latest.seo} /><GaugeCard label="Agentic browsing" value={latest.agentic} /></div><div className="grid gap-4 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle>Score history</CardTitle><CardDescription>{audits.length} most recent audits</CardDescription></CardHeader><CardContent><ChartContainer config={chartConfig} className="h-[280px] w-full"><AreaChart accessibilityLayer data={chartData}><CartesianGrid vertical={false} /><XAxis dataKey="date" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Area dataKey="performance" type="monotone" fill="var(--color-performance)" stroke="var(--color-performance)" fillOpacity={0.15} /><Area dataKey="accessibility" type="monotone" fill="var(--color-accessibility)" stroke="var(--color-accessibility)" fillOpacity={0.15} /><Area dataKey="agentic" type="monotone" fill="var(--color-agentic)" stroke="var(--color-agentic)" fillOpacity={0.15} /></AreaChart></ChartContainer></CardContent></Card><Card><CardHeader><CardTitle>Field data</CardTitle><CardDescription>From real Chrome visitors</CardDescription></CardHeader><CardContent className="space-y-2">{fieldStatus("LCP", latest.lcpMs, 2500, "ms")}{fieldStatus("INP", latest.inpMs, 200, "ms")}{fieldStatus("CLS", latest.cls, 0.1, "")}</CardContent></Card></div><Card><CardHeader><CardTitle>Agentic browsing checklist</CardTitle><CardDescription>Latest score: {latest.agentic ?? "—"}/100</CardDescription></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2">{checks.length ? checks.map((check) => <div key={check.key} className="rounded-md border p-3"><div className="flex items-start gap-2 text-sm font-medium">{check.passed ? <Check className="mt-0.5 size-4 text-emerald-600" /> : <X className="mt-0.5 size-4 text-orange-600" />}<span>{check.label}</span></div><p className="mt-1 pl-6 text-xs text-muted-foreground">{check.note}</p></div>) : <p className="text-sm text-muted-foreground">Checklist details are not available for this audit.</p>}</CardContent></Card></>}
  </div>;
}
