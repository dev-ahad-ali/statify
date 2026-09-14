export type EventType = "page_view" | "click" | "custom" | "server_request";

export interface Project {
  id: string;
  name: string;
  domain: string;
  allowedDomains: string[];
  apiKey: string | null;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface EventProperties {
  path?: string;
  query?: string;
  title?: string;
  referrer?: string;
  tagName?: string;
  elementId?: string;
  className?: string;
  text?: string;
  href?: string;
  [key: string]: unknown;
}

export interface Event {
  type: EventType;
  visitorId: string;
  sessionId: string;
  timestamp: number;
  properties: EventProperties;
  source?: "browser" | "server";
}

export interface BatchContext {
  userAgent: string;
  language: string;
  screen: string;
  hostname: string;
  automation?: {
    webdriver: boolean;
    headless: boolean;
    noPointer: boolean;
  };
}

export interface IngestPayload {
  apiKey: string;
  context: BatchContext;
  events: Event[];
}
