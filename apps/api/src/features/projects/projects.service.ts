import { projectCreateSchema, projectPatchSchema } from "@statify/shared";
import { randomHex, randomId } from "../../lib/crypto.js";
import { ProjectsRepository, type ProjectRow } from "./projects.repository.js";

const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const CACHE_TTL_SECONDS = 60 * 60;

export class ProjectValidationError extends Error {}
export class ProjectNotFoundError extends Error {}

type ProjectCache = { projectId: string; domain: string; allowedDomains: string[] };

function normalizeDomain(value: string) {
  const domain = value.trim().toLowerCase().replace(/\.$/, "");
  if (!DOMAIN_PATTERN.test(domain)) throw new ProjectValidationError(`Invalid domain: ${value}`);
  return domain;
}

function normalizeAllowedDomains(values: string[]) {
  return [...new Set(values.map(normalizeDomain))];
}

function parseAllowedDomains(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) throw new Error("Invalid domains");
    return parsed as string[];
  } catch {
    throw new Error("Stored allowed domains are invalid");
  }
}

export function serializeProject(project: ProjectRow) {
  return {
    id: project.id,
    name: project.name,
    domain: project.domain,
    api_key: project.api_key,
    allowed_domains: parseAllowedDomains(project.allowed_domains),
  };
}

function cacheValue(project: ProjectRow): ProjectCache {
  return { projectId: project.id, domain: project.domain, allowedDomains: parseAllowedDomains(project.allowed_domains) };
}

async function cacheProject(cache: KVNamespace, project: ProjectRow) {
  await cache.put(`apikey:${project.api_key}`, JSON.stringify(cacheValue(project)), { expirationTtl: CACHE_TTL_SECONDS });
}

async function findOwned(repository: ProjectsRepository, id: string, ownerId: string) {
  const project = await repository.findByIdOwned(id, ownerId);
  if (!project) throw new ProjectNotFoundError("Project not found");
  return project;
}

export async function listProjects(repository: ProjectsRepository, ownerId: string) {
  const result = await repository.listByOwner(ownerId);
  return result.results.map(serializeProject);
}

export async function createProject(repository: ProjectsRepository, cache: KVNamespace, ownerId: string, input: unknown) {
  const parsed = projectCreateSchema.safeParse(input);
  if (!parsed.success) throw new ProjectValidationError(parsed.error.issues[0]?.message ?? "Invalid project data");

  const domain = normalizeDomain(parsed.data.domain);
  const allowedDomains = normalizeAllowedDomains(parsed.data.allowed_domains);
  const now = Date.now();
  const project: ProjectRow = {
    id: randomId(), owner_id: ownerId, name: parsed.data.name, domain, api_key: `sf_${randomHex(32)}`,
    allowed_domains: JSON.stringify(allowedDomains), is_active: 1, created_at: now, updated_at: now,
  };
  try {
    await repository.create(project);
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) throw new ProjectValidationError("You already have a project for this domain");
    throw error;
  }
  await cacheProject(cache, project);
  return serializeProject(project);
}

export async function updateProject(repository: ProjectsRepository, cache: KVNamespace, id: string, ownerId: string, input: unknown) {
  const parsed = projectPatchSchema.safeParse(input);
  if (!parsed.success) throw new ProjectValidationError(parsed.error.issues[0]?.message ?? "Invalid project data");
  const project = await findOwned(repository, id, ownerId);
  const now = Date.now();

  if (parsed.data.name !== undefined) await repository.updateName(id, ownerId, parsed.data.name, now);
  if (parsed.data.allowed_domains !== undefined) {
    const allowedDomains = normalizeAllowedDomains(parsed.data.allowed_domains);
    await repository.updateAllowedDomains(id, ownerId, JSON.stringify(allowedDomains), now);
    await cache.delete(`apikey:${project.api_key}`);
  }
  const updated = await findOwned(repository, id, ownerId);
  await cacheProject(cache, updated);
  return serializeProject(updated);
}

export async function rotateApiKey(repository: ProjectsRepository, cache: KVNamespace, id: string, ownerId: string) {
  const project = await findOwned(repository, id, ownerId);
  const apiKey = `sf_${randomHex(32)}`;
  await repository.rotateApiKey(id, ownerId, apiKey, Date.now());
  await cache.delete(`apikey:${project.api_key}`);
  const updated = await findOwned(repository, id, ownerId);
  await cacheProject(cache, updated);
  return serializeProject(updated);
}

export async function deleteProject(repository: ProjectsRepository, cache: KVNamespace, id: string, ownerId: string) {
  const project = await findOwned(repository, id, ownerId);
  await repository.softDelete(id, ownerId, Date.now());
  await cache.delete(`apikey:${project.api_key}`);
}
