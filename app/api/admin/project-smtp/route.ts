import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, requireAdmin, testMailAllowed } from "@/lib/auth/admin";
import { db } from "@/lib/supabase/admin";
import { loadProjectSmtp, saveProjectSmtp, sendTestEmail, toSmtpConfig, verifySmtp } from "@/lib/smtp";
import { smtpSettingsSchema } from "@/lib/validation/smtp";
import { fail, internalError } from "@/lib/http";

const uuid = z.string().uuid();
const putSchema = z.object({ projectId: uuid, enabled: z.boolean(), settings: smtpSettingsSchema, password: z.string().max(500).optional() });
const testSchema = z.object({ projectId: uuid, action: z.enum(["verify", "test_email"]), to: z.string().email().optional() });

async function owns(adminId: string, projectId: string) {
  const { data } = await db().from("projects").select("id").eq("id", projectId).eq("owner_id", adminId).maybeSingle();
  return !!data;
}

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const id = new URL(req.url).searchParams.get("projectId");
    if (!uuid.safeParse(id).success || !(await owns(admin.id, id!))) return fail(404, "NOT_FOUND", "Project not found");
    const p = await loadProjectSmtp(id!);
    return NextResponse.json({ success: true, enabled: p?.enabled ?? false, settings: p?.settings ?? {}, hasPassword: !!p?.password });
  } catch (e) { return internalError(e); }
}

export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const p = putSchema.safeParse(await req.json().catch(() => null));
    if (!p.success) return fail(400, "INVALID_REQUEST", "Check the email settings (host, port, username, sender email).");
    if (!(await owns(admin.id, p.data.projectId))) return fail(404, "NOT_FOUND", "Project not found");
    const existing = await loadProjectSmtp(p.data.projectId);
    if (!p.data.password && !existing?.password) return fail(400, "INVALID_REQUEST", "Enter the app password.");
    await saveProjectSmtp(p.data.projectId, p.data.enabled, p.data.settings, p.data.password);
    await audit(admin.id, "project.smtp.update", "project", p.data.projectId, { enabled: p.data.enabled });
    return NextResponse.json({ success: true });
  } catch (e) { return internalError(e); }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const p = testSchema.safeParse(await req.json().catch(() => null));
    if (!p.success) return fail(400, "INVALID_REQUEST", "Invalid request");
    if (!(await owns(admin.id, p.data.projectId))) return fail(404, "NOT_FOUND", "Project not found");
    const saved = await loadProjectSmtp(p.data.projectId);
    const cfg = saved && toSmtpConfig(saved.settings, saved.password); // works before enabling, so settings can be tested first
    if (!cfg) return fail(400, "PROVIDER_NOT_CONFIGURED", "Save this project's email settings first.");
    if (p.data.action === "test_email" && !(await testMailAllowed(admin.id))) return fail(429, "RATE_LIMITED", "Test email limit reached (10 per hour).");
    const r = p.data.action === "verify" ? await verifySmtp(cfg) : await sendTestEmail(cfg, p.data.to ?? admin.email);
    await audit(admin.id, `provider.smtp.${p.data.action}`, "project", p.data.projectId, { ok: r.ok });
    return r.ok ? NextResponse.json({ success: true }) : fail(502, r.code, r.message);
  } catch (e) { return internalError(e); }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const id = new URL(req.url).searchParams.get("projectId");
    if (!uuid.safeParse(id).success || !(await owns(admin.id, id!))) return fail(404, "NOT_FOUND", "Project not found");
    await db().from("project_smtp").delete().eq("project_id", id!);
    await audit(admin.id, "project.smtp.delete", "project", id!);
    return NextResponse.json({ success: true });
  } catch (e) { return internalError(e); }
}
