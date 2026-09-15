"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChevronDown, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { createProject, getProjects, type WebProject } from "@/lib/projects";
import { getDashboard, type DashboardData } from "@/lib/dashboard";
import { LogoutButton } from "@/components/auth/logout-button";

const ranges = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["this_month", "This month"],
  ["12m", "Last 12 months"],
  ["all", "All time"],
] as const;

const chartConfig = {
  visitors: { label: "Visitors", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

function formatNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function updateUrl(router: ReturnType<typeof useRouter>, pathname: string, params: URLSearchParams, key: string, value: string) {
  params.set(key, value);
  router.push(`${pathname}?${params.toString()}`);
}

function LoadingDashboard() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 sm:grid-cols-3">
        {["visitors", "views", "sessions"].map((item) => <Skeleton key={item} className="h-28 rounded-xl border bg-card" />)}
      </div>
      <Skeleton className="h-[360px] rounded-xl border bg-card" />
    </div>
  );
}

function EmptyState({ project }: { project: WebProject }) {
  const snippet = `<script src="https://statify.pages.dev/statify.js" data-api-key="${project.api_key}" defer></script>`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Install Statify to see your first visit</CardTitle>
        <CardDescription>Add this script before the closing body tag on {project.domain}.</CardDescription>
      </CardHeader>
      <CardContent>
        <code className="block overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-6">{snippet}</code>
      </CardContent>
    </Card>
  );
}

function ProjectMenu({ projects, selected, onSelect, onCreated }: { projects: WebProject[]; selected: WebProject | null; onSelect: (project: WebProject) => void; onCreated: (project: WebProject) => void }) {
  const [open, setOpen] = useState(false);
  const [newProject, setNewProject] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const result = await createProject({ name, domain });
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? "Unable to create project");
      return;
    }
    onCreated(result.data);
    setName("");
    setDomain("");
    setNewProject(false);
    setOpen(false);
    toast.success("Project created");
  }

  return (
    <div className="relative">
      <Button variant="outline" className="min-w-52 justify-between" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="truncate text-left">{selected?.name ?? "Select a project"}</span><ChevronDown />
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
          {projects.map((project) => (
            <button key={project.id} type="button" className="flex w-full flex-col rounded-md px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { onSelect(project); setOpen(false); }}>
              <span className="font-medium">{project.name}</span><span className="text-xs text-muted-foreground">{project.domain}</span>
            </button>
          ))}
          <div className="my-1 border-t" />
          {!newProject ? (
            <button type="button" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent" onClick={() => setNewProject(true)}><Plus /> New project</button>
          ) : (
            <form className="space-y-3 p-3" onSubmit={submit}>
              <p className="text-sm font-medium">New project</p>
              <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Project name" className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <input required value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="example.com" className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <div className="flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setNewProject(false)}>Cancel</Button><Button size="sm" type="submit" disabled={saving}>{saving ? "Creating..." : "Create"}</Button></div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function RangeMenu({ range, onSelect }: { range: string; onSelect: (range: string) => void }) {
  const [open, setOpen] = useState(false);
  const label = ranges.find(([value]) => value === range)?.[1] ?? "Last 7 days";
  return (
    <div className="relative">
      <Button variant="outline" onClick={() => setOpen((value) => !value)} aria-expanded={open}>{label}<ChevronDown /></Button>
      {open && <div className="absolute right-0 z-10 mt-2 w-48 rounded-lg border bg-popover p-1 shadow-lg">{ranges.map(([value, text]) => <button key={value} type="button" className={`block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent ${value === range ? "bg-accent font-medium" : ""}`} onClick={() => { onSelect(value); setOpen(false); }}>{text}</button>)}</div>}
    </div>
  );
}

export function DashboardClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<WebProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const range = searchParams.get("range") ?? "7d";
  const projectId = searchParams.get("project");
  const selected = projects.find((project) => project.id === projectId) ?? projects[0] ?? null;

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectError(null);
    const result = await getProjects();
    if (result.error || !result.data) setProjectError(result.error ?? "Unable to load projects");
    else setProjects(result.data);
    setProjectsLoading(false);
  }, []);

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  useEffect(() => {
    if (projects.length > 0 && !projectId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("project", projects[0]!.id);
      params.set("range", range);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [pathname, projectId, projects, range, router, searchParams]);

  const loadDashboard = useCallback(async () => {
    if (!selected) return;
    setDashboardLoading(true);
    setDashboardError(null);
    const result = await getDashboard(selected.id, range);
    if (result.error || !result.data) setDashboardError(result.error ?? "Unable to load dashboard");
    else setDashboard(result.data);
    setDashboardLoading(false);
  }, [range, selected]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const chartData = useMemo(() => dashboard?.chart.map((point) => ({ ...point, label: new Date(`${point.date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }) })) ?? [], [dashboard]);

  if (projectsLoading) return <LoadingDashboard />;
  if (projectError) return <ErrorState message={projectError} onRetry={loadProjects} />;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm text-muted-foreground">Statify</p><h1 className="text-2xl font-semibold tracking-tight">Analytics</h1></div>
        <div className="flex flex-wrap items-center gap-2"><ProjectMenu projects={projects} selected={selected} onSelect={(project) => updateUrl(router, pathname, new URLSearchParams(searchParams.toString()), "project", project.id)} onCreated={(project) => { setProjects((current) => [...current, project]); updateUrl(router, pathname, new URLSearchParams(searchParams.toString()), "project", project.id); }} /><RangeMenu range={range} onSelect={(value) => updateUrl(router, pathname, new URLSearchParams(searchParams.toString()), "range", value)} /><LogoutButton /></div>
      </header>
      {projects.length === 0 || !selected ? <EmptyProjects /> : dashboardLoading && !dashboard ? <LoadingDashboard /> : dashboardError ? <ErrorState message={dashboardError} onRetry={loadDashboard} /> : dashboard ? <>
        {dashboard.summary.pageviews === 0 ? <EmptyState project={selected} /> : <>
          <div className="grid gap-4 sm:grid-cols-3"><SummaryCard label="Visitors" value={dashboard.summary.visitors} /><SummaryCard label="Page views" value={dashboard.summary.pageviews} /><SummaryCard label="Sessions" value={dashboard.summary.sessions} /></div>
          <Card><CardHeader><CardTitle>Visitors</CardTitle><CardDescription>{ranges.find(([value]) => value === range)?.[1] ?? "Last 7 days"}</CardDescription></CardHeader><CardContent><ChartContainer config={chartConfig} className="h-[320px] w-full"><AreaChart accessibilityLayer data={chartData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} /><ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""} />} /><Area dataKey="visitors" type="monotone" fill="var(--color-visitors)" fillOpacity={0.22} stroke="var(--color-visitors)" strokeWidth={2} dot={false} /></AreaChart></ChartContainer></CardContent></Card>
        </>}
      </> : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <Card className="gap-3 py-5"><CardHeader className="px-5"><CardDescription>{label}</CardDescription><CardTitle className="text-2xl tabular-nums">{formatNumber(value)}</CardTitle></CardHeader></Card>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void | Promise<void> }) {
  return <Card><CardHeader><CardTitle>We could not load this view</CardTitle><CardDescription>{message}</CardDescription></CardHeader><CardContent><Button variant="outline" onClick={() => void onRetry()}><RefreshCw /> Try again</Button></CardContent></Card>;
}

function EmptyProjects() {
  return <Card><CardHeader><CardTitle>Create your first project</CardTitle><CardDescription>Use the project switcher above to connect a domain to its Statify tracking script.</CardDescription></CardHeader></Card>;
}
