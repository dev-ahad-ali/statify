import { sha256Hex } from "./crypto.js";

export class RateLimitError extends Error {}

export async function enforceRateLimit(cache: KVNamespace, key: string, limit: number, ttlSeconds: number) {
  const current = Number.parseInt((await cache.get(key)) ?? "0", 10) || 0;
  if (current >= limit) throw new RateLimitError("Too many requests. Try again later.");
  await cache.put(key, String(current + 1), { expirationTtl: ttlSeconds });
}

export async function hashedRateLimitKey(scope: string, value: string) {
  return `rate:${scope}:${await sha256Hex(value)}`;
}

export async function reserveD1WriteBudget(cache: KVNamespace, eventCount: number, now = Date.now()) {
  const date = new Date(now).toISOString().slice(0, 10);
  const key = `budget:d1:${date}`;
  const estimatedWrites = Math.max(1, eventCount * 12);
  const current = Number.parseInt((await cache.get(key)) ?? "0", 10) || 0;
  const next = current + estimatedWrites;
  await cache.put(key, String(next), { expirationTtl: 8 * 24 * 60 * 60 });
  return { writeRawEvents: current < 90_000 && next <= 90_000, estimatedWrites, total: next };
}
