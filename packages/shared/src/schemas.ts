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
  automation: z.object({
    webdriver: z.boolean(),
    headless: z.boolean(),
    noPointer: z.boolean(),
  }).optional(),
});

export const ingestPayloadSchema = z.object({
  apiKey: z.string().min(1),
  context: batchContextSchema,
  events: z.array(eventSchema).min(1).max(50),
});

export const signupSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
});

export const forgotPasswordSchema = z.object({ email: z.string().trim().email() });
export const resetPasswordSchema = z.object({ token: z.string().min(1), password: z.string().min(8).max(128) });

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  domain: z.string().trim().min(1).max(253),
  allowed_domains: z.array(z.string().trim().min(1).max(253)).max(50).default([]),
});

export const projectPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    allowed_domains: z.array(z.string().trim().min(1).max(253)).max(50).optional(),
  })
  .refine((value) => value.name !== undefined || value.allowed_domains !== undefined, "At least one field is required");
