import { NextResponse } from "next/server";
import { z } from "zod";
import { auditAdmin, requireAdmin, testMailAllowedAdmin } from "@/lib/admin-auth";
import { loadStored, saveStored } from "@/lib/providers/config";
import { getSmtpConfig, sendTestEmail, verifySmtp, type SmtpConfig } from "@/lib/smtp";
import { getWaConfig, verifyWhatsApp } from "@/lib/whatsapp";
import { fail, internalError } from "@/lib/http";

const smtpSave = z.object({
  provider: z.literal("smtp"), enabled: z.boolean(),
  settings: z.object({
    host: z.string().min(1).max(255), port: z.number().int().min(1).max(65535),
    username: z.string().min(1).max(255), encryption: z.enum(["ssl", "tls"]),
    fromName: z.string().min(1).max(80), fromEmail: z.string().email(),
    replyTo: z.string().email().optional().or(z.literal("")), timeoutMs: z.number().int().min(2000).max(30000).default(10000),
  }),
  secrets: z.object({ password: z.string().max(500).optional() }),
});
const waSave = z.object({
  provider: z.literal("whatsapp"), enabled: z.boolean(),
  settings: z.object({
    phoneNumberId: z.string().regex(/^\d{5,30}$/), businessAccountId: z.string().regex(/^\d{5,30}$/).optional().or(z.literal("")),
    apiVersion: z.string().regex(/^v\d+\.\d+$/).default("v21.0"),
    templateName: z.string().regex(/^[a-z0-9_]{1,512}$/), templateLanguage: z.string().regex(/^[a-z]{2}(_[A-Z]{2})?$/),
  }),
  secrets: z.object({ accessToken: z.string().max(1000).optional() }),
});
const saveSchema = z.discriminatedUnion("provider", [smtpSave, waSave]);
const testSchema = z.object({ provider: z.enum(["smtp", "whatsapp"]), action: z.enum(["verify", "test_email"]), to: z.string().email().optional() });

// Secrets are write-only: only booleans saying whether one is stored go back.
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const [smtp, wa] = await Promise.all([loadStored("smtp"), loadStored("whatsapp")]);
    return NextResponse.json({
      success: true,
      smtp: { configured: !!(await getSmtpConfig()), enabled: smtp?.enabled ?? false, settings: smtp?.settings ?? {}, hasPassword: !!smtp?.secrets.password },
      whatsapp: { configured: !!(await getWaConfig()), enabled: wa?.enabled ?? false, settings: wa?.settings ?? {}, hasAccessToken: !!wa?.secrets.accessToken,
        message: (await getWaConfig()) ? undefined : "WhatsApp provider is not configured." },
    });
  } catch (e) { return internalError(e); }
}

export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const p = saveSchema.safeParse(await req.json().catch(() => null));
    if (!p.success) return fail(400, "INVALID_REQUEST", "Invalid provider settings");
    await saveStored(p.data.provider, p.data.enabled, p.data.settings, p.data.secrets);
    await auditAdmin("provider.update", "provider", p.data.provider, { enabled: p.data.enabled });
    return NextResponse.json({ success: true });
  } catch (e) { return internalError(e); }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const p = testSchema.safeParse(await req.json().catch(() => null));
    if (!p.success) return fail(400, "INVALID_REQUEST", "Invalid request");

    if (p.data.provider === "whatsapp") {
      const c = await getWaConfig();
      if (!c) return fail(400, "PROVIDER_NOT_CONFIGURED", "WhatsApp provider is not configured.");
      const r = await verifyWhatsApp(c);
      return r.ok ? NextResponse.json({ success: true }) : fail(502, r.code, r.message);
    }
    const c: SmtpConfig | null = await getSmtpConfig();
    if (!c) return fail(400, "PROVIDER_NOT_CONFIGURED", "Email provider is not configured.");
    if (p.data.action === "test_email" && !(await testMailAllowedAdmin())) return fail(429, "RATE_LIMITED", "Test email limit reached (10 per hour).");
    if (p.data.action === "test_email" && !p.data.to) return fail(400, "INVALID_REQUEST", "Enter the email address to send the test to.");
    const r = p.data.action === "verify" ? await verifySmtp(c) : await sendTestEmail(c, p.data.to!);
    await auditAdmin(`provider.smtp.${p.data.action}`, "provider", "smtp", { ok: r.ok });
    return r.ok ? NextResponse.json({ success: true }) : fail(502, r.code, r.message);
  } catch (e) { return internalError(e); }
}
