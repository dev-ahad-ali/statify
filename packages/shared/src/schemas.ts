import { z } from "zod";

export const projectSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  domain: z.string().min(1),
  allowedDomains: z.array(z.string()),
  apiKey: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export const eventSchema = z.object({
  type: z.enum(["page_view", "click", "custom"]),
  visitorId: z.string().min(1),
  sessionId: z.string().min(1),
  timestamp: z.number().int(),
  properties: z.record(z.string(), z.unknown()),
});

export const batchContextSchema = z.object({
  userAgent: z.string(),
  language: z.string(),
  screen: z.string(),
  hostname: z.string(),
});

export const ingestPayloadSchema = z.object({
  apiKey: z.string().min(1),
  context: batchContextSchema,
  events: z.array(eventSchema).min(1).max(100),
});
