import {
  classify,
  ingestPayloadSchema,
  verifyWebBotAuth,
  type AgentClassification,
  type Event,
} from "@statify/shared";
import { waitUntil } from "cloudflare:workers";
import { UAParser } from "ua-parser-js";
import { runtimeEnv } from "../../config/env.js";
import { randomId } from "../../lib/crypto.js";
import {
  enforceRateLimit,
  RateLimitError,
  reserveD1WriteBudget,
} from "../../lib/rate-limit.js";
import { IngestRepository, type IngestProject } from "./ingest.repository.js";
import {
  writeEventBatch,
  type IngestContext,
  type QueuedEvent,
} from "./rollup.service.js";

export class IngestValidationError extends Error {}
export class IngestUnauthorizedError extends Error {}
export class IngestOriginError extends Error {}
export { RateLimitError as IngestRateLimitError };

type IngestRequest = { cf?: Record<string, string | undefined> };
type ForwardedHeaders = Record<string, string | undefined>;

function optionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getOriginHostname(origin: string | undefined) {
  if (!origin) throw new IngestOriginError("Origin is required");
  try {
    return new URL(origin).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    throw new IngestOriginError("Invalid Origin header");
  }
}

async function lookupProject(
  apiKey: string,
  repository: IngestRepository,
): Promise<IngestProject | null> {
  const cached = await runtimeEnv.CACHE.get(`apikey:${apiKey}`, "json");
  if (cached && typeof cached === "object") {
    const value = cached as Partial<IngestProject>;
    if (
      typeof value.projectId === "string" &&
      typeof value.domain === "string" &&
      Array.isArray(value.allowedDomains)
    ) {
      return {
        projectId: value.projectId,
        domain: value.domain,
        allowedDomains: value.allowedDomains.filter(
          (domain): domain is string => typeof domain === "string",
        ),
      };
    }
  }

  const project = await repository.findProjectByApiKey(apiKey);
  if (project)
    await runtimeEnv.CACHE.put(`apikey:${apiKey}`, JSON.stringify(project), {
      expirationTtl: 60 * 60,
    });
  return project;
}

function enrichEvent(
  event: Event,
  context: IngestContext,
  receivedAt: number,
  classification: AgentClassification,
): QueuedEvent {
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
    agentCategory: classification.category,
    agentVendor: classification.vendor ?? null,
    agentHarness: classification.harness ?? null,
    agentConfidence: classification.confidence.toFixed(1),
    source: event.source ?? "browser",
    vitalName: optionalString(properties.vitalName),
    vitalValue: optionalNumber(properties.vitalValue),
    vitalRating: optionalString(properties.vitalRating),
  };
}

export async function queueIngest(
  rawBody: string,
  origin: string | undefined,
  userAgent: string,
  headers: ForwardedHeaders,
  cf: Record<string, string | undefined> | undefined,
  repository: IngestRepository,
) {
  let input: unknown;
  try {
    input = JSON.parse(rawBody);
  } catch {
    throw new IngestValidationError("Request body must be valid JSON");
  }

  const parsed = ingestPayloadSchema.safeParse(input);
  if (!parsed.success)
    throw new IngestValidationError(
      parsed.error.issues[0]?.message ?? "Invalid ingest payload",
    );
  await enforceRateLimit(
    runtimeEnv.CACHE,
    `rate:ingest:${parsed.data.apiKey}:${Math.floor(Date.now() / 60_000)}`,
    600,
    120,
  );

  const serverEventCount = parsed.data.events.filter(
    (event) => event.source === "server",
  ).length;
  if (serverEventCount > 0 && serverEventCount !== parsed.data.events.length) {
    throw new IngestValidationError(
      "A batch cannot mix browser and server events",
    );
  }

  const project = await lookupProject(parsed.data.apiKey, repository);
  if (!project) throw new IngestUnauthorizedError("Unknown API key");

  if (serverEventCount === 0) {
    const originHostname = getOriginHostname(origin);
    const allowedDomains = [project.domain, ...project.allowedDomains].map(
      (domain) => domain.toLowerCase(),
    );
    if (!allowedDomains.includes(originHostname))
      throw new IngestOriginError("Origin is not allowed for this project");
  }

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
  const firstProperties = parsed.data.events[0]?.properties ?? {};
  const verification = await verifyWebBotAuth(
    {
      method: headers["x-statify-original-method"] ?? "GET",
      url:
        headers["x-statify-original-url"] ??
        `https://${context.hostname}${optionalString(firstProperties.path) ?? "/"}`,
      headers,
      signature: headers.signature,
      signatureInput: headers["signature-input"],
      signatureAgent: headers["signature-agent"],
    },
    runtimeEnv.CACHE,
  );
  const signaturePresent = Boolean(
    headers.signature ||
    headers["signature-input"] ||
    headers["signature-agent"],
  );
  const classification = classify({
    userAgent,
    headers,
    automation: parsed.data.context.automation,
    verified: verification.verified
      ? { vendor: verification.vendor ?? "unknown", model: verification.model }
      : undefined,
    signatureFailed: signaturePresent && !verification.verified,
  });
  const events = parsed.data.events.map((event) =>
    enrichEvent(event, context, receivedAt, classification),
  );
  const budget = await reserveD1WriteBudget(runtimeEnv.CACHE, events.length);

  waitUntil(
    writeEventBatch(
      runtimeEnv.DB,
      project.projectId,
      events,
      budget.writeRawEvents,
    ).catch((error: unknown) => {
      console.error("ingest batch failed", {
        projectId: project.projectId,
        batchSize: events.length,
        writeRawEvents: budget.writeRawEvents,
        error,
      });
    }),
  );
}

export function requestCloudflareProperties(request: IngestRequest) {
  return request.cf;
}
