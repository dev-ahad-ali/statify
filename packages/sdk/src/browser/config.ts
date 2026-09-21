const DEFAULT_ENDPOINT =
  "https://statify-api-prod.ahadali-dev.workers.dev/ingest";

export type BrowserConfig = {
  apiKey: string;
  endpoint: string;
  batchSize: number;
  batchTimeout: number;
};

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readConfig(): BrowserConfig | null {
  const script =
    document.currentScript instanceof HTMLScriptElement
      ? document.currentScript
      : [...document.scripts].find((candidate) =>
          candidate.src.includes("statify.js"),
        );
  const apiKey = script?.dataset.apiKey;
  if (!apiKey) return null;

  return {
    apiKey,
    endpoint: script.dataset.endpoint || DEFAULT_ENDPOINT,
    batchSize: Math.floor(positiveNumber(script.dataset.batchSize, 10)),
    batchTimeout: positiveNumber(script.dataset.batchTimeout, 5000),
  };
}
