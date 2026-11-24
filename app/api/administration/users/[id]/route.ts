import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, buildUser, isBootstrapAdmin, requireAdmin, type UserRow } from "@/lib/auth/admin";
import { db } from "@/lib/supabase/admin";
import { loadFeatures } from "@/lib/platform";
import { firebaseAuth } from "@/lib/firebase/admin";
import { fail, internalError } from "@/lib/http";

const UUID = /^[0-9a-f-]{36}$/i;
type Ctx = { params: { id: string } };
const num = z.number().int().min(0).max(1000000).nullable().optional();
const patchSchema = z.object({
  displayName: z.string().max(80).nullable().optional(), notes: z.string().max(1000).nullable().optional(),
  role: z.enum(["user", "admin", "owner"]).optional(), status: z.enum(["pending", "active", "suspended"]).optional(),
  features: z.record(z.string().regex(/^[a-z][a-z0-9_]{1,40}$/), z.boolean().nullable()).optional(),
  limits: z.object({ maxProjects: num, maxKeysPerProject: num, dailyOtpLimit: num }).optional(),
});

export async function GET(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    if (!UUID.test(params.id)) return fail(404, "NOT_FOUND", "User not found");
    const { data: p } = await db().from("admin_profiles").select("*").eq("id", params.id).maybeSingle();
    if (!p) return fail(404, "NOT_FOUND", "User not found");
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: projects } = await db().from("projects").select("id,name,status,website_url,created_at,api_keys(id,status,last_used_at)").eq("owner_id", p.id).order("created_at", { ascending: false });
    const ids = (projects ?? []).map((x: any) => x.id);
    let otp: any[] = [], verify: any[] = [], recent: any[] = [], smtp = 0;
    if (ids.length) {
      const r = await Promise.all([
        db().from("otp_requests").select("channel,status,created_at").in("project_id", ids).gte("created_at", since).limit(20000),
        db().from("api_usage").select("status_code").in("project_id", ids).eq("endpoint", "otp/verify").gte("created_at", since).limit(20000),
        db().from("otp_requests").select("id,channel,status,masked_recipient,created_at,projects(name)").in("project_id", ids).order("created_at", { ascending: false }).limit(15),
        db().from("project_smtp").select("project_id", { count: "exact", head: true }).in("project_id", ids).eq("enabled", true),
      ]);
      otp = r[0].data ?? []; verify = r[1].data ?? []; recent = r[2].data ?? []; smtp = r[3].count ?? 0;
    }
    const cnt = (action: string) => db().from("audit_logs").select("id", { count: "exact", head: true }).eq("admin_id", p.id).eq("action", action);
    const [activity, tests, exports, cat] = await Promise.all([
      db().from("audit_logs").select("action,entity_type,entity_id,created_at").eq("admin_id", p.id).order("created_at", { ascending: false }).limit(30),
      cnt("test_otp.send"), cnt("logs.export"), loadFeatures(),
    ]);
    const daily: Record<string, number> = {};
    for (const r of otp) { const d = r.created_at.slice(0, 10); daily[d] = (daily[d] ?? 0) + 1; }
    const keys = (projects ?? []).flatMap((x: any) => x.api_keys ?? []);
    const email = otp.filter((r) => r.channel === "email").length, wa = otp.filter((r) => r.channel === "whatsapp").length;
    const effective = (await buildUser(p as UserRow)).features;
    return NextResponse.json({
      success: true,
      user: { id: p.id, email: p.email, name: p.display_name, role: p.role, status: p.status, notes: p.notes, created_at: p.created_at, last_login_at: p.last_login_at, features: p.features ?? {}, limits: p.limits ?? {} },
      effective, catalog: cat, projects: projects ?? [], recent, activity: activity.data ?? [],
      usage: { total: otp.length, email, whatsapp: wa, failed: otp.filter((r) => r.status === "failed").length,
        verifyOk: verify.filter((v) => v.status_code === 200).length, verifyFail: verify.filter((v) => v.status_code === 400).length,
        daily: Object.entries(daily).sort().map(([date, count]) => ({ date, count })) },
      featureUsage: [
        { key: "email_otp", label: "Email OTP", value: `${email} sent (30d)` }, { key: "whatsapp_otp", label: "WhatsApp OTP", value: `${wa} sent (30d)` },
        { key: "api_keys", label: "API keys", value: `${keys.filter((k: any) => k.status === "active").length} active of ${keys.length}` },
        { key: "project_smtp", label: "Own email sender", value: `${smtp} project(s)` },
        { key: "test_otp", label: "Test OTP", value: `${tests.count ?? 0} test(s)` }, { key: "csv_export", label: "CSV export", value: `${exports.count ?? 0} export(s)` },
      ],
    });
  } catch (e) { return internalError(e); }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const { data: t } = UUID.test(params.id) ? await db().from("admin_profiles").select("*").eq("id", params.id).maybeSingle() : { data: null };
    if (!t) return fail(404, "NOT_FOUND", "User not found");
    const b = patchSchema.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail(400, "INVALID_REQUEST", "Invalid values");
    const self = t.id === admin.id;
    if (t.role !== "user" && !self && admin.role !== "owner") return fail(403, "FORBIDDEN", "Only an owner can modify administrators.");
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (b.data.displayName !== undefined) patch.display_name = b.data.displayName;
    if (b.data.notes !== undefined) patch.notes = b.data.notes;
    if (b.data.role !== undefined && b.data.role !== t.role) {
      if (admin.role !== "owner") return fail(403, "FORBIDDEN", "Only an owner can change roles.");
      if (self) return fail(400, "INVALID_REQUEST", "You cannot change your own role.");
      if (isBootstrapAdmin(t.email)) return fail(400, "INVALID_REQUEST", "This account is an owner set in ADMIN_ALLOWLIST.");
      patch.role = b.data.role;
    }
    if (b.data.status !== undefined && b.data.status !== t.status) {
      if (self) return fail(400, "INVALID_REQUEST", "You cannot change your own status.");
      if (isBootstrapAdmin(t.email)) return fail(400, "INVALID_REQUEST", "This account is an owner set in ADMIN_ALLOWLIST.");
      patch.status = b.data.status;
    }
    if (b.data.features) {
      const f: Record<string, boolean> = { ...(t.features ?? {}) };
      for (const [k, v] of Object.entries(b.data.features)) { if (v === null) delete f[k]; else f[k] = v; }
      patch.features = f;
    }
    if (b.data.limits) {
      const l: Record<string, number> = { ...(t.limits ?? {}) };
      for (const [k, v] of Object.entries(b.data.limits)) { if (v === null) delete l[k]; else if (v !== undefined) l[k] = v; }
      patch.limits = l;
    }
    const { error } = await db().from("admin_profiles").update(patch).eq("id", t.id);
    if (error) throw error;
    await audit(admin.id, "user.update", "user", t.id, { fields: Object.keys(patch).filter((k) => k !== "updated_at") });
    return NextResponse.json({ success: true });
  } catch (e) { return internalError(e); }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const { data: t } = UUID.test(params.id) ? await db().from("admin_profiles").select("id,email,role,firebase_uid").eq("id", params.id).maybeSingle() : { data: null };
    if (!t) return fail(404, "NOT_FOUND", "User not found");
    if (t.id === admin.id) return fail(400, "INVALID_REQUEST", "You cannot delete yourself.");
    if (isBootstrapAdmin(t.email)) return fail(400, "INVALID_REQUEST", "This account is an owner set in ADMIN_ALLOWLIST.");
    if (t.role !== "user" && admin.role !== "owner") return fail(403, "FORBIDDEN", "Only an owner can delete administrators.");
    await db().from("projects").delete().eq("owner_id", t.id); // cascades keys, OTP records, logs
    const { error } = await db().from("admin_profiles").delete().eq("id", t.id);
    if (error) throw error;
    try { await firebaseAuth().deleteUser(t.firebase_uid); } catch { /* login may already be gone */ }
    await audit(admin.id, "user.delete", "user", t.id, { email: t.email });
    return NextResponse.json({ success: true });
  } catch (e) { return internalError(e); }
}
