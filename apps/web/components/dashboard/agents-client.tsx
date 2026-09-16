"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ArrowLeft, Bot, ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useDemo } from "@/components/dashboard/demo-context";
import { getAgents, type AgentsData } from "@/lib/dashboard";
import { demoProject, getDemoAgents } from "@/lib/demo";
import { getProjects, type WebProject } from "@/lib/projects";

const ranges = [["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["this_month", "This month"], ["12m", "Last 12 months"], ["all", "All time"]] as const;
const chartConfig: ChartConfig = { crawler: { label: "Crawler", color: "var(--color-chart-1)" }, agent: { label: "Agent", color: "var(--color-chart-2)" }, automation: { label: "Automation", color: "var(--color-chart-3)" } };

export function AgentsClient({ demo: demoProp }: { demo?: boolean } = {}) {
  const contextDemo = useDemo();
  const demo = demoProp ?? contextDemo;
  const [projects, setProjects] = useState<WebProject[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [data, setData] = useState<AgentsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const [range, setRange] = useState(params.get("range") ?? "7d");
  const [vendor, setVendor] = useState(params.get("vendor") ?? "");
  const [projectId, setProjectId] = useState(params.get("project"));
  const selected = demo ? demoProject : projects.find((project) => project.id === projectId) ?? projects[0] ?? null;

  const setUrl = useCallback((key: string, value: string | null) => {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value); else next.delete(key);
    window.history.pushState({}, "", `${window.location.pathname}?${next.toString()}`);
    if (key === "range") setRange(value ?? "7d");
    if (key === "vendor") setVendor(value ?? "");
    if (key === "project") setProjectId(value);
  }, []);

  useEffect(() => {
    if (demo) { setProjects([demoProject]); setLoading(false); return; }
    void getProjects().then((result) => { if (result.error || !result.data) setError(result.error ?? "Unable to load projects"); else setProjects(result.data); setLoading(false); });
  }, [demo]);

  const load = useCallback(async () => {
    if (!selected) return;
    setError(null);
    if (demo) setData(getDemoAgents(range, vendor || undefined));
    else { const result = await getAgents(selected.id, range, vendor || undefined); if (result.error || !result.data) setError(result.error ?? "Unable to load agent analytics"); else setData(result.data); }
  }, [demo, range, selected, vendor]);
  useEffect(() => { void load(); }, [load]);

  const chartData = useMemo(() => { const grouped = new Map<string, Record<string, string | number>>(); data?.chart.forEach((row) => { const point = grouped.get(row.date) ?? { date: row.date }; point[row.category] = row.visits; grouped.set(row.date, point); }); return [...grouped.values()]; }, [data]);
  if (loading) return <div className="h-96 animate-pulse rounded-xl bg-muted" />;
  if (error) return <Card><CardHeader><CardTitle>We could not load agent analytics</CardTitle><CardDescription>{error}</CardDescription></CardHeader><CardContent><Button variant="outline" onClick={() => void load()}><RefreshCw /> Try again</Button></CardContent></Card>;
  if (!selected || !data) return <Card><CardHeader><CardTitle>No project selected</CardTitle><CardDescription>Create a project before opening agent analytics.</CardDescription></CardHeader></Card>;
  const rangeLabel = ranges.find(([value]) => value === range)?.[1] ?? "Last 7 days";
  return <div className="space-y-6">
    <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between"><div><Button variant="ghost" size="sm" asChild><Link href={demo ? "/demo" : `/dashboard?project=${encodeURIComponent(selected.id)}`}><ArrowLeft /> Dashboard</Link></Button><div className="mt-2 flex items-center gap-2"><Bot className="size-5" /><div><p className="text-sm text-muted-foreground">Agent analytics</p><h1 className="text-2xl font-semibold tracking-tight">{selected.name}</h1></div></div></div><div className="flex gap-2"><RangeMenu value={range} onChange={(value) => setUrl("range", value)} /><VendorMenu value={vendor} onChange={(value) => setUrl("vendor", value)} /></div></header>
    <div className="grid gap-4 sm:grid-cols-3"><Stat label="Agent visits" value={data.summary.agentVisits} /><Stat label="Human visits" value={data.summary.humanVisits} /><Stat label="Agent share" value={`${(data.summary.agentRatio * 100).toFixed(1)}%`} /></div>
    <Card><CardHeader><CardTitle>Agent visits</CardTitle><CardDescription>{rangeLabel}</CardDescription></CardHeader><CardContent><ChartContainer config={chartConfig} className="h-[320px] w-full"><AreaChart accessibilityLayer data={chartData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}><CartesianGrid vertical={false} /><XAxis dataKey="date" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} /><ChartTooltip content={<ChartTooltipContent />} /><Area dataKey="crawler" type="monotone" stackId="agents" fill="var(--color-crawler)" stroke="var(--color-crawler)" fillOpacity={0.7} /><Area dataKey="agent" type="monotone" stackId="agents" fill="var(--color-agent)" stroke="var(--color-agent)" fillOpacity={0.7} /><Area dataKey="automation" type="monotone" stackId="agents" fill="var(--color-automation)" stroke="var(--color-automation)" fillOpacity={0.7} /></AreaChart></ChartContainer></CardContent></Card>
    <div className="grid gap-4 lg:grid-cols-3"><AgentCard title="By vendor" rows={data.byVendor} confidence /><AgentCard title="By harness" rows={data.byHarness} /><AgentCard title="Top paths" rows={data.paths} /></div>
  </div>;
}

function Stat({ label, value }: { label: string; value: number | string }) { return <Card className="gap-3 py-5"><CardHeader className="px-5"><CardDescription>{label}</CardDescription><CardTitle className="text-2xl tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</CardTitle></CardHeader></Card>; }
function AgentCard({ title, rows, confidence }: { title: string; rows: Array<{ dimension: string; visits: number; confidence?: string }>; confidence?: boolean }) { return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><div className="max-h-64 space-y-1 overflow-y-auto">{rows.map((row) => <div key={row.dimension} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"><span className="min-w-0 flex-1 truncate">{row.dimension}</span>{confidence && row.confidence && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{row.confidence} confidence</span>}<span className="tabular-nums text-muted-foreground">{row.visits.toLocaleString()}</span></div>)}</div></CardContent></Card>; }
function RangeMenu({ value, onChange }: { value: string; onChange: (value: string) => void }) { const [open, setOpen] = useState(false); return <div className="relative"><Button variant="outline" onClick={() => setOpen(!open)}>{ranges.find(([item]) => item === value)?.[1] ?? "Last 7 days"}<ChevronDown /></Button>{open && <div className="absolute right-0 z-10 mt-2 w-48 rounded-lg border bg-popover p-1 shadow-lg">{ranges.map(([item, label]) => <button key={item} type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { onChange(item); setOpen(false); }}>{label}</button>)}</div>}</div>; }
function VendorMenu({ value, onChange }: { value: string; onChange: (value: string | null) => void }) { const [open, setOpen] = useState(false); const vendors = ["OpenAI", "Anthropic", "Perplexity", "Google"]; return <div className="relative"><Button variant="outline" onClick={() => setOpen(!open)}>{value || "All vendors"}<ChevronDown /></Button>{open && <div className="absolute right-0 z-10 mt-2 w-40 rounded-lg border bg-popover p-1 shadow-lg"><button type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { onChange(null); setOpen(false); }}>All vendors</button>{vendors.map((vendor) => <button key={vendor} type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { onChange(vendor); setOpen(false); }}>{vendor}</button>)}</div>}</div>; }
