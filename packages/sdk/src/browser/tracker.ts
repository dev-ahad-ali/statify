import type { Event, IngestPayload } from "@statify/shared";
import { sessionId, visitorId } from "./identity.js";
import type { EventQueue } from "./batcher.js";
import { onCLS, onINP, onLCP } from "web-vitals";

function text(value: string | null | undefined) {
  return value?.trim().slice(0, 100) || undefined;
}

function currentPath() {
  return `${window.location.pathname}${window.location.search}`;
}

export function createTracker(queue: EventQueue) {
  let pointerSeen = false;
  const chromeUserAgent = /Chrome\//i.test(navigator.userAgent);
  const automation = () => ({
    webdriver: Boolean(navigator.webdriver),
    headless: /HeadlessChrome/i.test(navigator.userAgent),
    noPointer: !pointerSeen,
  });
  const context = () => {
    const hints = automation();
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      screen: `${window.screen.width}x${window.screen.height}`,
      hostname: window.location.hostname,
      automation: { ...hints, noPointer: hints.noPointer || (chromeUserAgent && !(window as Window & { chrome?: unknown }).chrome) },
    };
  };
  const add = (event: Pick<Event, "type" | "properties">) => {
    const currentSessionId = sessionId();
    queue.add({ ...event, visitorId: visitorId(), sessionId: currentSessionId, timestamp: Date.now() });
  };
  const pageView = () => add({ type: "page_view", properties: { path: currentPath(), title: document.title, referrer: document.referrer } });

  document.addEventListener("mousemove", () => { pointerSeen = true; }, { capture: true, passive: true });
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const element = target.closest("a, button");
    if (!element) return;
    add({
      type: "click",
      properties: {
        tagName: element.tagName.toLowerCase(),
        elementId: element.id || undefined,
        className: element.className || undefined,
        text: text(element.textContent),
        href: element instanceof HTMLAnchorElement ? element.href : undefined,
      },
    });
  }, { capture: true });

  window.addEventListener("popstate", pageView);
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new PopStateEvent("popstate"));
      return result;
    };
  }

  pageView();
  return {
    context,
    flush: queue.flush,
  };
}

export function trackWebVitals(queue: EventQueue) {
  const addVital = (metric: { name: string; value: number; rating: string }) => {
    queue.add({
      type: "custom",
      visitorId: visitorId(),
      sessionId: sessionId(),
      timestamp: Date.now(),
      properties: { vitalName: metric.name, vitalValue: metric.value, vitalRating: metric.rating },
    });
  };
  onLCP(addVital);
  onINP(addVital);
  onCLS(addVital);
}
