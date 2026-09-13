import { ingestPayloadSchema, type Event } from "@statify/shared";
import { waitUntil } from "cloudflare:workers";
import { UAParser } from "ua-parser-js";
import { runtimeEnv } from "../../config/env.js";
import { randomId } from "../../lib/crypto.js";
import { IngestRepository, type IngestProject } from "./ingest.repository.js";
import { writeEventBatch, type IngestContext, type QueuedEvent } from "./rollup.service.js";

export class IngestValidationError extends Error {}
export class IngestUnauthorizedError extends Error {}
export class IngestOriginError extends Error {}

type IngestRequest = { cf?: Record<string, string | undefined> };

function optionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getOriginHostname(origin: string | undefined) {
  if (!origin) throw new IngestOriginError("Origin is required");
  try {
    return new URL(origin).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    throw new IngestOriginError("Invalid Origin header");
  }
}

async function lookupProject(apiKey: string, repository: IngestRepository): Promise<IngestProject | null> {
  const cached = await runtimeEnv.CACHE.get(`apikey:${apiKey}`, "json");
  if (cached && typeof cached === "object") {
    const value = cached as Partial<IngestProject>;
    if (typeof value.projectId === "string" && typeof value.domain === "string" && Array.isArray(value.allowedDomains)) {
      return { projectId: value.projectId, domain: value.domain, allowedDomains: value.allowedDomains.filter((domain): domain is string => typeof domain === "string") };
    }
  }

  const project = await repository.findProjectByApiKey(apiKey);
  if (project) await runtimeEnv.CACHE.put(`apikey:${apiKey}`, JSON.stringify(project), { expirationTtl: 60 * 60 });
  return project;
}

function enrichEvent(event: Event, context: IngestContext, receivedAt: number): QueuedEvent {
  const properties = event.properties;
  return {
    id: randomId(),
    type: event.type,
    visitorId: event.visitorId,
    sessionId: event.sessionId,
    timestamp: event.timestamp,
    receivedAt,
    path: optionalString(properties.path),
    query: optionalString(properties.query),
    title: optionalString(properties.title),
    referrer: optionalString(properties.referrer),
    tagName: optionalString(properties.tagName),
    elementId: optionalString(properties.elementId),
    className: optionalString(properties.className),
    text: optionalString(properties.text),
    href: optionalString(properties.href),
    userAgent: context.userAgent,
    browser: context.browser,
    os: context.os,
    device: context.device,
    language: context.language,
    screen: context.screen,
    hostname: context.hostname,
    country: context.country,
    region: context.region,
    city: context.city,
    timezone: context.timezone,
    agentCategory: optionalString(properties.agentCategory),
    agentVendor: optionalString(properties.agentVendor),
    agentHarness: optionalString(properties.agentHarness),
    agentConfidence: optionalString(properties.agentConfidence),
    source: "browser",
  };
}

export async function queueIngest(rawBody: string, origin: string | undefined, userAgent: string, cf: Record<string, string | undefined> | undefined, repository: IngestRepository) {
  let input: unknown;
  try {
    input = JSON.parse(rawBody);
  } catch {
    throw new IngestValidationError("Request body must be valid JSON");
  }

  const parsed = ingestPayloadSchema.safeParse(input);
  if (!parsed.success) throw new IngestValidationError(parsed.error.issues[0]?.message ?? "Invalid ingest payload");

  const project = await lookupProject(parsed.data.apiKey, repository);
  if (!project) throw new IngestUnauthorizedError("Unknown API key");

  const originHostname = getOriginHostname(origin);
  const allowedDomains = [project.domain, ...project.allowedDomains].map((domain) => domain.toLowerCase());
  if (!allowedDomains.includes(originHostname)) throw new IngestOriginError("Origin is not allowed for this project");

  const parsedAgent = new UAParser(userAgent).getResult();
  const context: IngestContext = {
    userAgent,
    language: parsed.data.context.language,
    screen: parsed.data.context.screen,
    hostname: parsed.data.context.hostname,
    browser: parsedAgent.browser.name ?? "unknown",
    os: parsedAgent.os.name ?? "unknown",
    device: parsedAgent.device.type ?? "desktop",
    country: cf?.country ?? "unknown",
    region: cf?.region ?? "unknown",
    city: cf?.city ?? "unknown",
    timezone: cf?.timezone ?? "unknown",
  };
  const receivedAt = Date.now();
  const events = parsed.data.events.map((event) => enrichEvent(event, context, receivedAt));

  waitUntil(
    writeEventBatch(runtimeEnv.DB, project.projectId, events).catch((error: unknown) => {
      console.error("ingest batch failed", { projectId: project.projectId, batchSize: events.length, error });
    }),
  );
}

export function requestCloudflareProperties(request: IngestRequest) {
  return request.cf;
}
