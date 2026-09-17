"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { codeToHtml } from "shiki";
import { Copy, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { installSnippets } from "@statify/shared/snippets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getProjects, updateProject, rotateProjectKey, deleteProject, type WebProject } from "@/lib/projects";

const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function normalizeDomain(value: string) {
  const input = value.trim().toLowerCase();
  if (!input) return "";

  try {
    const url = new URL(/^https?:\/\//.test(input) ? input : `https://${input}`);
    return url.hostname.replace(/\.$/, "");
  } catch {
    return input.replace(/^https?:\/\//, "").split("/")[0]?.replace(/\.$/, "") ?? "";
  }
}

export function SettingsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<WebProject[]>([]);
  const [loading, setLoading] = useState(true);
  const projectId = searchParams.get("project");
  const project = projects.find((item) => item.id === projectId) ?? projects[0] ?? null;

  useEffect(() => {
    getProjects().then((result) => {
      if (result.error || !result.data) toast.error(result.error ?? "Unable to load projects");
      else setProjects(result.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (project && !projectId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("project", project.id);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [pathname, project, projectId, router, searchParams]);

  if (loading) return <div className="h-96 animate-pulse rounded-xl bg-muted" />;
  if (!project) return <Card><CardHeader><CardTitle>No project selected</CardTitle><CardDescription>Create a project from the dashboard before opening settings.</CardDescription></CardHeader></Card>;

  function replaceProject(updated: WebProject) {
    setProjects((current) => current.map((item) => item.id === updated.id ? updated : item));
  }

  return <SettingsView project={project} onProjectChange={replaceProject} onDeleted={() => router.replace("/dashboard")} />;
}

function SettingsView({ project, onProjectChange, onDeleted }: { project: WebProject; onProjectChange: (project: WebProject) => void; onDeleted: () => void }) {
  const [tab, setTab] = useState("general");
  const [name, setName] = useState(project.name);
  const [savingName, setSavingName] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [savingDomains, setSavingDomains] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => setName(project.name), [project.id, project.name]);

  async function saveName() {
    setSavingName(true);
    const result = await updateProject(project.id, { name: name.trim() });
    setSavingName(false);
    if (result.error || !result.data) toast.error(result.error ?? "Unable to save project name");
    else { onProjectChange(result.data); toast.success("Project name updated"); }
  }

  async function saveDomains(nextDomains: string[]) {
    setSavingDomains(true);
    const result = await updateProject(project.id, { allowed_domains: nextDomains });
    setSavingDomains(false);
    if (result.error || !result.data) toast.error(result.error ?? "Unable to save allowed domains");
    else { onProjectChange(result.data); setDomainInput(""); toast.success("Allowed domains updated"); }
  }

  async function addDomain(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const domain = normalizeDomain(domainInput);
    setDomainInput(domain);
    if (!DOMAIN_PATTERN.test(domain)) { toast.error("Enter a valid domain"); return; }
    if (domain === project.domain || project.allowed_domains.includes(domain)) { toast.error("That domain is already listed"); return; }
    await saveDomains([...project.allowed_domains, domain]);
  }

  async function rotate() {
    setRotating(true);
    const result = await rotateProjectKey(project.id);
    setRotating(false);
    if (result.error || !result.data) toast.error(result.error ?? "Unable to rotate API key");
    else { onProjectChange(result.data); toast.success("API key rotated"); setTab("install"); }
  }

  async function removeDomain(domain: string) {
    await saveDomains(project.allowed_domains.filter((item) => item !== domain));
  }

  return <div className="space-y-6">
    <div><p className="text-sm text-muted-foreground">Project settings</p><h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1><p className="mt-1 text-sm text-muted-foreground">Manage {project.domain}</p></div>
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <TabsList><TabsTrigger value="general">General</TabsTrigger><TabsTrigger value="domains">Domains</TabsTrigger><TabsTrigger value="install">Install</TabsTrigger><TabsTrigger value="danger">Danger</TabsTrigger></TabsList>
      <TabsContent value="general"><Card><CardHeader><CardTitle>Project details</CardTitle><CardDescription>Change the name shown in your dashboard. The project domain cannot be changed.</CardDescription></CardHeader><CardContent className="space-y-5">
        <label className="grid gap-2 text-sm font-medium">Project name<input value={name} onChange={(event) => setName(event.target.value)} className="h-10 rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
        <label className="grid gap-2 text-sm font-medium">Domain<input value={project.domain} readOnly className="h-10 rounded-md border bg-muted px-3 font-normal text-muted-foreground" /></label>
        <Button onClick={() => void saveName()} disabled={savingName || !name.trim()}><Save />{savingName ? "Saving..." : "Save changes"}</Button>
        <div className="border-t pt-5"><p className="text-sm font-medium">API key</p><div className="mt-2 flex gap-2"><code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-3 py-2 text-sm">{project.api_key}</code><CopyButton value={project.api_key} /></div><Button className="mt-3" variant="outline" onClick={() => setRotating(true)} disabled={rotating}><RefreshCw /> Rotate key</Button></div>
      </CardContent></Card></TabsContent>
      <TabsContent value="domains"><Card><CardHeader><CardTitle>Allowed domains</CardTitle><CardDescription>Only these browser origins can send events for this project.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="space-y-2"><DomainRow domain={project.domain} primary /><div className="divide-y rounded-lg border">{project.allowed_domains.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No additional domains.</p> : project.allowed_domains.map((domain) => <DomainRow key={domain} domain={domain} onRemove={() => void removeDomain(domain)} />)}</div></div><form className="flex flex-col gap-2 sm:flex-row" onSubmit={addDomain}><div className="flex-1"><input value={domainInput} onChange={(event) => setDomainInput(event.target.value)} onBlur={() => setDomainInput(normalizeDomain(domainInput))} placeholder="https://www.example.com" aria-describedby="domain-help" className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" /><p id="domain-help" className="mt-1 text-xs text-muted-foreground">You can paste a URL. The protocol and path are removed automatically.</p></div><Button type="submit" disabled={savingDomains}>{savingDomains ? "Saving..." : "Add domain"}</Button></form></CardContent></Card></TabsContent>
      <TabsContent value="install"><InstallTab project={project} /></TabsContent>
      <TabsContent value="danger"><Card className="border-destructive/50"><CardHeader><CardTitle>Delete project</CardTitle><CardDescription>This removes the project from your account and stops accepting events. Existing data will remain in the database until retention cleanup.</CardDescription></CardHeader><CardContent><Button variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 /> Delete project</Button></CardContent></Card><DeleteDialog project={project} open={deleteOpen} onOpenChange={setDeleteOpen} onDeleted={onDeleted} /></TabsContent>
    </Tabs>
    <Dialog open={rotating} onOpenChange={setRotating}><DialogContent><DialogHeader><DialogTitle>Rotate API key?</DialogTitle><DialogDescription>The old key will stop accepting events. Update your sites with the new key after rotation.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setRotating(false)}>Cancel</Button><Button onClick={() => void rotate()}>Rotate key</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function DomainRow({ domain, primary, onRemove }: { domain: string; primary?: boolean; onRemove?: () => void }) {
  return <div className="flex items-center justify-between gap-3 p-3 text-sm"><span className="truncate">{domain}{primary && <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">Primary</span>}</span>{onRemove && <Button variant="ghost" size="sm" onClick={onRemove}>Remove</Button>}</div>;
}

function CopyButton({ value }: { value: string }) {
  return <Button variant="outline" size="icon" aria-label="Copy API key" onClick={() => { void navigator.clipboard.writeText(value); toast.success("Copied"); }}><Copy /></Button>;
}

function InstallTab({ project }: { project: WebProject }) {
  const [selected, setSelected] = useState(installSnippets[0]!);
  const [html, setHtml] = useState("");
  const code = useMemo(() => selected.code.replaceAll("YOUR_API_KEY", project.api_key), [project.api_key, selected.code]);
  useEffect(() => { let active = true; void codeToHtml(code, { lang: selected.language, theme: "github-dark" }).then((result) => { if (active) setHtml(result); }); return () => { active = false; }; }, [code, selected.language]);
  return <Card><CardHeader><CardTitle>Install Statify</CardTitle><CardDescription>Choose your framework and add the generated snippet to {project.domain}.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="flex flex-wrap gap-2">{installSnippets.map((snippet) => <Button key={snippet.label} variant={snippet.label === selected.label ? "default" : "outline"} size="sm" onClick={() => setSelected(snippet)}>{snippet.label}</Button>)}</div><div className="relative overflow-hidden rounded-lg bg-[#24292e]"><div className="flex justify-end border-b border-white/10 p-2"><Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" onClick={() => { void navigator.clipboard.writeText(code); toast.success("Snippet copied"); }}><Copy /> Copy</Button></div>{html ? <div className="overflow-x-auto p-4 text-sm [&_pre]:m-0" dangerouslySetInnerHTML={{ __html: html }} /> : <pre className="overflow-x-auto p-4 text-sm text-white">{code}</pre>}</div></CardContent></Card>;
}

function DeleteDialog({ project, open, onOpenChange, onDeleted }: { project: WebProject; open: boolean; onOpenChange: (open: boolean) => void; onDeleted: () => void }) {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  async function remove() {
    setDeleting(true);
    const result = await deleteProject(project.id);
    setDeleting(false);
    if (result.error) toast.error(result.error);
    else { toast.success("Project deleted"); onDeleted(); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Delete {project.name}?</DialogTitle><DialogDescription>Type <strong>{project.domain}</strong> to confirm. This cannot be undone.</DialogDescription></DialogHeader><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={project.domain} className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" /><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="destructive" disabled={confirmation !== project.domain || deleting} onClick={() => void remove()}>{deleting ? "Deleting..." : "Delete project"}</Button></DialogFooter></DialogContent></Dialog>;
}
