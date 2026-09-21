import type { IngestPayload } from "@statify/shared";

const CONTENT_TYPE = "text/plain";

export function sendBeacon(endpoint: string, payload: IngestPayload) {
  const body = JSON.stringify(payload);
  if (typeof navigator.sendBeacon !== "function") return false;
  return navigator.sendBeacon(
    endpoint,
    new Blob([body], { type: CONTENT_TYPE }),
  );
}

export function sendFetch(endpoint: string, payload: IngestPayload) {
  return fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": CONTENT_TYPE },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}
