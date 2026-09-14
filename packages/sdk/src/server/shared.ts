import type { IngestPayload } from "@statify/shared";

const DEFAULT_ENDPOINT = "https://statify-api-prod.ahadali-dev.workers.dev/ingest";
const SERVER_EVENT_TIMEOUT_MS = 2_000;

export type ServerSdkOptions = {
  apiKey: string;
  endpoint?: string;
};

export type ServerRequest = {
  method: string;
  url: string;
  ip?: string;
  getHeader: (name: string) => string | undefined;
};

function dailySalt() {
  return new Date().toISOString().slice(0, 10);
}

async function visitorId(request: ServerRequest) {
  const ip = request.ip || request.getHeader("x-forwarded-for")?.split(",")[0]?.trim() || request.getHeader("cf-connecting-ip") || "unknown";
  const value = `${ip}${request.getHeader("user-agent") ?? "unknown"}${dailySalt()}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requestPath(url: string) {
  try {
    return new URL(url, "http://statify.local").pathname + new URL(url, "http://statify.local").search;
  } catch {
    return url;
  }
}

function shouldTrack(request: ServerRequest) {
  const path = requestPath(request.url);
  const accept = request.getHeader("accept") ?? "";
  return ["GET", "HEAD"].includes(request.method.toUpperCase()) && accept.includes("text/html") && !/\.[a-z\d]{1,8}$/i.test(path);
}

export async function buildServerPayload(options: ServerSdkOptions, request: ServerRequest): Promise<IngestPayload | null> {
  if (!shouldTrack(request)) return null;
  const id = await visitorId(request);
  const timestamp = Date.now();
  const day = dailySalt();
  const userAgent = request.getHeader("user-agent") ?? "unknown";
  const headers = {
    signature: request.getHeader("signature"),
    signatureInput: request.getHeader("signature-input"),
    signatureAgent: request.getHeader("signature-agent"),
    accept: request.getHeader("accept"),
  };

  return {
    apiKey: options.apiKey,
    context: {
      userAgent,
      language: request.getHeader("accept-language") ?? "unknown",
      screen: "server",
      hostname: request.getHeader("host")?.split(":")[0] ?? "unknown",
    },
    events: [{
      type: "server_request",
      source: "server",
      visitorId: id,
      sessionId: `server:${id}:${day}`,
      timestamp,
      properties: {
        path: requestPath(request.url),
        referrer: request.getHeader("referer"),
        signature: headers.signature,
        signatureInput: headers.signatureInput,
        signatureAgent: headers.signatureAgent,
        accept: headers.accept,
      },
    }],
  };
}

export async function sendServerRequest(options: ServerSdkOptions, request: ServerRequest) {
  const payload = await buildServerPayload(options, request);
  if (!payload) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SERVER_EVENT_TIMEOUT_MS);
  try {
    await fetch(options.endpoint ?? DEFAULT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    // Server analytics must never change the request outcome.
  } finally {
    clearTimeout(timeout);
  }
}
