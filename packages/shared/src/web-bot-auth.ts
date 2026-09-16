export type WebBotAuthRequest = {
  method: string;
  url: string;
  headers: Record<string, string | undefined>;
  signature?: string;
  signatureInput?: string;
  signatureAgent?: string;
};

export type WebBotAuthResult = { verified: boolean; vendor?: string; keyId?: string; model?: string };

export type WebBotAuthCache = {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<unknown>;
};

const vendors: Record<string, string> = {
  "openai.com": "OpenAI",
  "anthropic.com": "Anthropic",
  "perplexity.ai": "Perplexity",
  "google.com": "Google",
};

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function parseSignatureInput(value: string) {
  const match = value.match(/(?:^|,\s*)([^=]+)=\(([^)]*)\)(.*)$/);
  if (!match) return null;
  const components = [...(match[2] ?? "").matchAll(/"([^"]+)"/g)].map((item) => item[1]!);
  const params = match[3]!.trim().replace(/^;/, "");
  const keyId = params.match(/(?:^|;)keyid="([^"]+)"/)?.[1];
  if (!components.length || !keyId) return null;
  return { components, params, keyId };
}

function signatureValue(value: string, label: string) {
  const match = value.match(new RegExp(`(?:^|,\\s*)${label}=:(.*?):`));
  return match?.[1];
}

function headerValue(headers: Record<string, string | undefined>, name: string) {
  const lower = name.toLowerCase();
  return Object.entries(headers).find(([key]) => key.toLowerCase() === lower)?.[1];
}

function signatureBase(request: WebBotAuthRequest, components: string[], params: string) {
  const url = new URL(request.url);
  const lines = components.map((component) => {
    if (component === "@method") return `"@method": ${request.method.toUpperCase()}`;
    if (component === "@target-uri") return `"@target-uri": ${url.toString()}`;
    if (component === "@authority") return `"@authority": ${url.host}`;
    return `"${component}": ${headerValue(request.headers, component) ?? ""}`;
  });
  lines.push(`"@signature-params": (${components.map((component) => `"${component}"`).join(" ")});${params}`);
  return lines.join("\n");
}

async function directory(origin: string, cache?: WebBotAuthCache, fetchFn = fetch) {
  const cacheKey = `web-bot-auth:${origin}`;
  const cached = await cache?.get(cacheKey, "text");
  if (cached) return JSON.parse(cached) as { keys?: Array<Record<string, unknown>>; publicKeys?: Array<Record<string, unknown>> };
  const response = await fetchFn(`${origin}/.well-known/http-message-signatures-directory`);
  if (!response.ok) throw new Error(`Web Bot Auth directory returned ${response.status}`);
  const value = await response.json() as { keys?: Array<Record<string, unknown>>; publicKeys?: Array<Record<string, unknown>> };
  await cache?.put(cacheKey, JSON.stringify(value), { expirationTtl: 86_400 });
  return value;
}

export async function verifyWebBotAuth(request: WebBotAuthRequest, cache?: WebBotAuthCache, fetchFn = fetch): Promise<WebBotAuthResult> {
  if (!request.signature || !request.signatureInput || !request.signatureAgent) return { verified: false };
  try {
    const agentOrigin = new URL(request.signatureAgent).origin;
    const parsed = parseSignatureInput(request.signatureInput);
    if (!parsed) return { verified: false };
    const signature = signatureValue(request.signature, request.signatureInput.split("=")[0]!);
    if (!signature) return { verified: false };
    const directoryValue = await directory(agentOrigin, cache, fetchFn);
    const keys = directoryValue.keys ?? directoryValue.publicKeys ?? [];
    const key = keys.find((item) => item.kid === parsed.keyId || item.keyid === parsed.keyId);
    if (!key || key.kty !== "OKP" || key.crv !== "Ed25519" || typeof key.x !== "string") return { verified: false };
    const cryptoKey = await crypto.subtle.importKey("jwk", key as JsonWebKey, { name: "Ed25519" }, false, ["verify"]);
    const valid = await crypto.subtle.verify({ name: "Ed25519" }, cryptoKey, decodeBase64Url(signature), new TextEncoder().encode(signatureBase(request, parsed.components, parsed.params)));
    if (!valid) return { verified: false };
    const hostname = new URL(agentOrigin).hostname;
    const vendor = Object.entries(vendors).find(([domain]) => hostname === domain || hostname.endsWith(`.${domain}`))?.[1] ?? hostname;
    return { verified: true, vendor, keyId: parsed.keyId, model: headerValue(request.headers, "x-agent-model") };
  } catch {
    return { verified: false };
  }
}
