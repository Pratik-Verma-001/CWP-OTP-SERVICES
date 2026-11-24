import { z } from "zod";

export const sendSchema = z.discriminatedUnion("channel", [
  z.object({ channel: z.literal("email"), recipient: z.string().email().max(254), project: z.string().min(1).max(80) }),
  z.object({ channel: z.literal("whatsapp"), recipient: z.string().regex(/^\+[1-9]\d{7,14}$/, "Use E.164 format"), project: z.string().min(1).max(80) }),
]);
export const verifySchema = z.object({
  requestId: z.string().uuid(),
  code: z.string().regex(/^\d{4,10}$/),
});
export const projectSchema = z.object({
  name: z.string().min(1).max(80),
  websiteUrl: z.string().url().optional(),
  description: z.string().max(500).optional(),
  allowedOrigins: z.array(z.string().url()).max(20).default([]),
});
export const keyCreateSchema = z.object({ projectId: z.string().uuid(), name: z.string().min(1).max(80) });
export const keyActionSchema = z.object({ keyId: z.string().uuid(), action: z.enum(["disable", "enable", "revoke", "rotate"]) });
