import type { IngestPayload } from "@statify/shared";
import type { BrowserConfig } from "./config.js";
import { sendBeacon, sendFetch } from "./sender.js";

export type EventQueue = {
  add: (event: IngestPayload["events"][number]) => void;
  flush: (preferBeacon?: boolean) => void;
};

export function createBatcher(config: BrowserConfig, getPayload: (events: IngestPayload["events"]) => IngestPayload): EventQueue {
  let queue: IngestPayload["events"] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = (preferBeacon = false) => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (queue.length === 0) return;
    const events = queue;
    queue = [];
    const payload = getPayload(events);
    if (!preferBeacon || !sendBeacon(config.endpoint, payload)) void sendFetch(config.endpoint, payload);
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => flush(false), config.batchTimeout);
  };

  return {
    add(event) {
      queue.push(event);
      if (queue.length >= config.batchSize) flush(false);
      else schedule();
    },
    flush,
  };
}
