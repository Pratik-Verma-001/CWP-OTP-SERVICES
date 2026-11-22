import { z } from "zod";
export const smtpSettingsSchema = z.object({
  host: z.string().min(1).max(255), port: z.number().int().min(1).max(65535), username: z.string().min(1).max(255),
  encryption: z.enum(["ssl", "tls"]), fromName: z.string().min(1).max(80), fromEmail: z.string().email(),
  replyTo: z.string().email().optional().or(z.literal("")), timeoutMs: z.number().int().min(2000).max(30000).default(10000),
});
