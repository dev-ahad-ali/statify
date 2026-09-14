import type { IngestPayload } from "@statify/shared";
import { createBatcher } from "./batcher.js";
import { readConfig } from "./config.js";
import { createTracker } from "./tracker.js";

const config = readConfig();
if (config) {
  let getContext = () => ({ userAgent: "", language: "", screen: "", hostname: "" });
  const queue = createBatcher(config, (events) => ({
    apiKey: config.apiKey,
    context: getContext(),
    events,
  }));
  const tracker = createTracker(queue);
  getContext = tracker.context;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") tracker.flush(true);
  });
  window.addEventListener("pagehide", () => tracker.flush(true));
}
